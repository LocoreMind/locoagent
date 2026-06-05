#!/usr/bin/env bun
/**
 * hf-daily-papers.ts
 * Pure browser-automation workflow: Fetch HuggingFace Daily Papers data.
 *
 * No LLM involved. All steps are deterministic agent-browser commands.
 *
 * Steps:
 *   1. Open HuggingFace /papers (redirects to today's date)
 *   2. Extract all paper titles, links, upvotes, thumbnail URLs
 *   3. Filter by minUpvotes, take top N
 *   4. For each selected paper: open detail page, extract abstract
 *   5. Download thumbnail images
 *   6. Save papers.json data file
 *
 * Config is passed as --config JSON from workflow-engine.ts
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

// ── Config ───────────────────────────────────────────────────────────────────

interface Config {
  maxPapers: number
  minUpvotes: number
  cdpPort: number
  platform?: string
  proxy?: string
  abstractMaxChars: number
  downloadThumbnails: boolean
  saveDataJson?: boolean
  outputDir?: string
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)

const proxyFlag = config.proxy ? `--proxy ${config.proxy}` : ''
const sessionFlag = config.platform && config.platform !== 'x' ? ` --session ${config.platform}` : ''
// OUTPUT_DIR is set after we detect the actual HF date from redirect URL
let OUTPUT_DIR = ''

// ── Helpers ──────────────────────────────────────────────────────────────────

function ab(cmd: string): string {
  try {
    return execSync(`agent-browser --cdp ${config.cdpPort}${sessionFlag} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: ROOT,
    }).trim()
  } catch (e: any) {
    console.error(`[ab] Failed: ${cmd}`)
    console.error(e.stderr?.slice(0, 200) || e.message)
    return ''
  }
}

function abEval(js: string): string {
  // Write JS to a temp file to avoid shell quoting issues
  const tmpJs = resolve(OUTPUT_DIR, '.eval-tmp.js')
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(tmpJs, js, 'utf-8')
  try {
    let result = execSync(
      `agent-browser --cdp ${config.cdpPort}${sessionFlag} eval "$(cat '${tmpJs}')"`,
      { encoding: 'utf-8', timeout: 30000, cwd: ROOT }
    ).trim()
    // agent-browser eval wraps output in quotes — strip them for JSON parsing
    if (result.startsWith('"') && result.endsWith('"')) {
      try {
        result = JSON.parse(result) as string
      } catch (_) {}
    }
    return result
  } catch (e: any) {
    console.error(`[abEval] Failed`)
    console.error(e.stderr?.slice(0, 200) || e.message)
    return ''
  }
}

// ── Step tracking ────────────────────────────────────────────────────────────

interface StepResult {
  step: string
  status: 'success' | 'failed' | 'skipped'
  detail?: string
}

const steps: StepResult[] = []
const TOTAL_STEPS = 3 // fetch_list, fetch_abstracts, download_thumbnails

interface Paper {
  title: string
  link: string
  arxivId: string
  upvotes: number
  thumbnail: string
  abstract: string
}

let papers: Paper[] = []

function log(msg: string): void {
  console.error(`[hf-daily-papers] ${msg}`)
}

function outputResult() {
  const completedSteps = steps.filter(s => s.status === 'success').length
  const result = {
    stepsCompleted: completedSteps,
    stepsTotal: TOTAL_STEPS,
    papers: papers.map(p => ({ title: p.title, arxivId: p.arxivId, upvotes: p.upvotes })),
    steps,
  }
  console.log(JSON.stringify(result))
}

// ── Step 1: Fetch paper list ─────────────────────────────────────────────────

log('Step 1/3: Fetching paper list from HuggingFace...')

ab('open https://huggingface.co/papers')

// Wait a moment for redirect
ab('wait 2000')

const currentUrl = ab('get url')
log(`Page loaded: ${currentUrl}`)

// Extract actual date from redirect URL: https://huggingface.co/papers/date/YYYY-MM-DD
const dateMatch = currentUrl.match(/\/papers\/date\/(\d{4}-\d{2}-\d{2})/)
const hfDate = dateMatch ? dateMatch[1]! : new Date().toISOString().split('T')[0]!
log(`HuggingFace date: ${hfDate}`)

// Set OUTPUT_DIR using actual HF date (not system date)
OUTPUT_DIR = resolve(ROOT, 'workflows', config.outputDir ?? '.tmp', `hf-${hfDate}`)

const papersJson = abEval(
  `JSON.stringify(Array.from(document.querySelectorAll('h3')).map(h => {
    const card = h.closest('div')?.parentElement;
    const link = h.querySelector('a')?.href || '';
    const arxivId = link.split('/papers/')[1] || '';
    const labelEl = card?.parentElement?.querySelector('label');
    const upvotes = parseInt(labelEl?.textContent?.trim() || '0', 10);
    return { title: h.textContent.trim(), link, arxivId, upvotes };
  }))`
)

try {
  const raw = JSON.parse(papersJson) as Array<{ title: string; link: string; arxivId: string; upvotes: number }>
  papers = raw
    .filter(p => p.upvotes >= config.minUpvotes && p.arxivId)
    .slice(0, config.maxPapers)
    .map(p => ({
      ...p,
      thumbnail: `https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/${p.arxivId}.png`,
      abstract: '',
    }))
  log(`Found ${raw.length} papers, selected ${papers.length} (>=${config.minUpvotes} upvotes)`)
  steps.push({ step: 'fetch_list', status: 'success', detail: `${papers.length} papers selected` })
} catch (e: any) {
  log(`Failed to parse papers: ${e.message}`)
  steps.push({ step: 'fetch_list', status: 'failed', detail: e.message })
  outputResult()
  process.exit(1)
}

if (papers.length === 0) {
  log('No papers matched criteria. Exiting.')
  steps.push({ step: 'fetch_abstracts', status: 'skipped' })
  steps.push({ step: 'download_thumbnails', status: 'skipped' })
  outputResult()
  process.exit(0)
}

// ── Step 2: Fetch abstracts ──────────────────────────────────────────────────

log('Step 2/3: Fetching abstracts...')

for (const paper of papers) {
  ab(`open ${paper.link}`)
  ab('wait 1500')

  const abstractText = abEval(
    `document.querySelectorAll('h2')[0]?.nextElementSibling?.textContent || ''`
  )

  if (abstractText) {
    // Take first N chars, cut at last sentence boundary
    let short = abstractText.slice(0, config.abstractMaxChars)
    const lastDot = short.lastIndexOf('.')
    if (lastDot > config.abstractMaxChars * 0.5) {
      short = short.slice(0, lastDot + 1)
    } else {
      short += '...'
    }
    paper.abstract = short
    log(`  ✓ ${paper.arxivId}: ${short.slice(0, 60)}...`)
  } else {
    paper.abstract = paper.title
    log(`  ✗ ${paper.arxivId}: no abstract, using title`)
  }
}

steps.push({ step: 'fetch_abstracts', status: 'success', detail: `${papers.length} abstracts fetched` })

// ── Step 3: Download thumbnails ──────────────────────────────────────────────

log('Step 3/3: Downloading thumbnails...')

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

if (config.downloadThumbnails) {
  for (const paper of papers) {
    const thumbPath = resolve(OUTPUT_DIR, `${paper.arxivId}.png`)
    try {
      execSync(`curl -sL ${proxyFlag} -o "${thumbPath}" "${paper.thumbnail}"`, { timeout: 30000 })
      if (existsSync(thumbPath)) {
        log(`  ✓ ${paper.arxivId}.png downloaded`)
      }
    } catch (_) {
      log(`  ✗ ${paper.arxivId}.png download failed`)
    }
  }
  steps.push({ step: 'download_thumbnails', status: 'success' })
} else {
  steps.push({ step: 'download_thumbnails', status: 'skipped' })
}

// ── Save data JSON ───────────────────────────────────────────────────────────

if (config.saveDataJson) {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const dataPath = resolve(OUTPUT_DIR, 'papers.json')
  const data = {
    date: hfDate,
    source: `https://huggingface.co/papers/date/${hfDate}`,
    fetchedAt: new Date().toISOString(),
    totalPapers: papers.length,
    papers: papers.map((p, i) => ({
      rank: i + 1,
      title: p.title,
      arxivId: p.arxivId,
      link: p.link,
      upvotes: p.upvotes,
      thumbnail: `${p.arxivId}.png`,
      thumbnailUrl: p.thumbnail,
      abstract: p.abstract,
    })),
  }
  writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  log(`Data saved to ${dataPath}`)
}

// ── Output result ────────────────────────────────────────────────────────────

outputResult()
