#!/usr/bin/env bun
/**
 * hf-papers-to-x.ts
 * End-to-end workflow: HuggingFace Daily Papers → X.com posts.
 *
 * Steps:
 *   1. Fetch paper list from HuggingFace (detect actual date from redirect URL)
 *   2. Check if this date was already processed (compare with last run)
 *   3. Filter out already-posted papers (arxivId dedup via posted-papers.json)
 *   4. Fetch abstracts for new papers
 *   5. Download thumbnails (via proxy)
 *   6. Post each new paper as image+text tweet to X.com (no links/tags in main post)
 *   7. Self-reply to each post with paper link (avoids X.com link throttling)
 *   8. Update posted-papers.json and save daily papers.json
 *
 * No LLM involved. Pure browser automation.
 * Config is passed as --config JSON from workflow-engine.ts
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const POSTED_PATH = resolve(ROOT, 'workflows', '.tmp', 'posted-papers.json')
const STATE_PATH = resolve(ROOT, 'workflows', 'state.json')

// ── Config ───────────────────────────────────────────────────────────────────

interface Config {
  maxPapers: number
  minUpvotes: number
  cdpPort: number
  platform?: string
  proxy?: string
  abstractMaxChars: number
  outputDir?: string
  xUsername?: string
  hfDate?: string  // Override date (e.g. "2026-05-06") — fetches that day's papers instead of today's
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)

const proxyFlag = config.proxy ? `--proxy ${config.proxy}` : ''
const sessionFlag = config.platform && config.platform !== 'x' ? ` --session ${config.platform}` : ''
const xUsername = config.xUsername ?? 'mashijiann'

// ── Posted-papers dedup store ────────────────────────────────────────────────

interface PostedEntry {
  arxivId: string
  title: string
  postedAt: string
  hfDate: string
}

interface PostedStore {
  version: number
  description: string
  papers: PostedEntry[]
}

function loadPosted(): PostedStore {
  if (!existsSync(POSTED_PATH)) {
    return { version: 1, description: 'Global dedup: tracks all papers posted to X.com by arxivId', papers: [] }
  }
  return JSON.parse(readFileSync(POSTED_PATH, 'utf-8')) as PostedStore
}

function savePosted(store: PostedStore): void {
  const dir = dirname(POSTED_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(POSTED_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

const postedStore = loadPosted()
const postedIds = new Set(postedStore.papers.map(p => p.arxivId))

// ── Workflow state checkpoint ────────────────────────────────────────────────

/**
 * Check if the workflow has been stopped externally (e.g. by agent).
 * Reads state.json and returns true if stopped.
 * Executors should call this between expensive operations (e.g. between posting papers).
 */
function checkWorkflowStopped(): boolean {
  try {
    if (!existsSync(STATE_PATH)) return false
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
    const ws = state.workflows?.['hf-papers-to-x']
    if (!ws) return false
    return ws.status === 'stopped'
  } catch (_) {}
  return false
}

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

function abEval(js: string, tmpDir: string): string {
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
  const tmpJs = resolve(tmpDir, '.eval-tmp.js')
  writeFileSync(tmpJs, js, 'utf-8')
  try {
    let result = execSync(
      `agent-browser --cdp ${config.cdpPort}${sessionFlag} eval "$(cat '${tmpJs}')"`,
      { encoding: 'utf-8', timeout: 30000, cwd: ROOT }
    ).trim()
    if (result.startsWith('"') && result.endsWith('"')) {
      try { result = JSON.parse(result) as string } catch (_) {}
    }
    return result
  } catch (e: any) {
    console.error(`[abEval] Failed`)
    console.error(e.stderr?.slice(0, 200) || e.message)
    return ''
  }
}

function findRef(pattern: string): string {
  const snapshot = ab('snapshot -i -c')
  const match = snapshot.match(new RegExp(`${pattern}.*?\\[ref=(e\\d+)\\]`))
  return match ? `@${match[1]}` : ''
}

// ── Types & State ────────────────────────────────────────────────────────────

interface Paper {
  title: string
  link: string
  arxivId: string
  upvotes: number
  thumbnail: string
  abstract: string
  posted: boolean
  skippedDedup: boolean
}

interface StepResult {
  step: string
  status: 'success' | 'failed' | 'skipped'
  detail?: string
}

const steps: StepResult[] = []
const TOTAL_STEPS = 4
let papers: Paper[] = []
let postedCount = 0
let skippedCount = 0
let failedCount = 0

function log(msg: string): void {
  console.error(`[hf-papers-to-x] ${msg}`)
}

function outputResult(hfDate: string) {
  const completedSteps = steps.filter(s => s.status === 'success').length
  const result = {
    stepsCompleted: completedSteps,
    stepsTotal: TOTAL_STEPS,
    hfDate,
    papers: papers.map(p => ({ title: p.title, arxivId: p.arxivId, upvotes: p.upvotes, posted: p.posted, skippedDedup: p.skippedDedup })),
    posted: postedCount,
    skipped: skippedCount,
    failed: failedCount,
    steps,
  }
  console.log(JSON.stringify(result))
}

// ── Tab management ──────────────────────────────────────────────────────────
// Two dedicated tabs: one for HuggingFace, one for X.com.
// All HF navigation (paper list, abstracts) stays in the HF tab.
// All X.com navigation (posting, replying) stays in the X tab.
// This avoids cross-domain navigation which triggers Chrome "Leave site?" popups.
// Tab indices are determined dynamically since the browser may have pre-existing tabs.

function getActiveTabIndex(): number {
  const listing = ab('tab list')
  // Strip ANSI escape codes, then find active tab marked with → prefix
  const clean = listing.replace(/\x1b\[\d*m/g, '')
  const match = clean.match(/→\s*\[(\d+)\]/)
  return match ? parseInt(match[1]!, 10) : 0
}

let tabHF = getActiveTabIndex()  // Current tab becomes HF tab
let tabX = -1                     // Will be set when Tab 2 is created

function switchToHF(): void {
  ab(`tab ${tabHF}`)
  ab('wait 300')
}

function switchToX(): void {
  if (tabX < 0) return
  ab(`tab ${tabX}`)
  ab('wait 300')
}

// ── Step 1: Fetch paper list & detect actual date ───────────────────────────

log('Step 1/4: Fetching paper list from HuggingFace...')
const hfUrl = config.hfDate
  ? `https://huggingface.co/papers/date/${config.hfDate}`
  : 'https://huggingface.co/papers'
// Tab 1 (current tab) = HuggingFace
ab(`open ${hfUrl}`)
ab('wait 2000')

const currentUrl = ab('get url')
log(`Page loaded: ${currentUrl}`)

// Extract actual date from redirect URL: https://huggingface.co/papers/date/YYYY-MM-DD
const dateMatch = currentUrl.match(/\/papers\/date\/(\d{4}-\d{2}-\d{2})/)
const hfDate = config.hfDate ?? (dateMatch ? dateMatch[1]! : new Date().toISOString().split('T')[0]!)
log(`HuggingFace date: ${hfDate}`)

// OUTPUT_DIR uses the actual HF date, not system date
const OUTPUT_DIR = resolve(ROOT, 'workflows', config.outputDir ?? '.tmp', `hf-${hfDate}`)

const papersJson = abEval(
  `JSON.stringify(Array.from(document.querySelectorAll('h3')).map(h => {
    const card = h.closest('div')?.parentElement;
    const link = h.querySelector('a')?.href || '';
    const arxivId = link.split('/papers/')[1] || '';
    const labelEl = card?.parentElement?.querySelector('label');
    const upvotes = parseInt(labelEl?.textContent?.trim() || '0', 10);
    return { title: h.textContent.trim(), link, arxivId, upvotes };
  }))`,
  OUTPUT_DIR
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
      posted: false,
      skippedDedup: postedIds.has(p.arxivId),
    }))
  const newPapers = papers.filter(p => !p.skippedDedup)
  log(`Found ${raw.length} papers, selected ${papers.length} (>=${config.minUpvotes} upvotes), ${newPapers.length} new (${papers.length - newPapers.length} already posted)`)
  steps.push({ step: 'fetch_list', status: 'success', detail: `${papers.length} selected, ${newPapers.length} new` })
} catch (e: any) {
  log(`Failed to parse papers: ${e.message}`)
  steps.push({ step: 'fetch_list', status: 'failed', detail: e.message })
  outputResult(hfDate)
  process.exit(1)
}

const newPapers = papers.filter(p => !p.skippedDedup)

if (newPapers.length === 0) {
  log('No new papers to post (all already posted or none matched criteria).')
  steps.push({ step: 'fetch_abstracts', status: 'skipped' })
  steps.push({ step: 'download_thumbnails', status: 'skipped' })
  steps.push({ step: 'post_to_x', status: 'skipped' })
  skippedCount = papers.length
  outputResult(hfDate)
  process.exit(0)
}

// ── Step 2: Fetch abstracts (only for new papers) ───────────────────────────

log('Step 2/4: Fetching abstracts...')
// Stay in Tab 1 (HF) — paper detail pages are same domain
switchToHF()
for (const paper of newPapers) {
  ab(`open ${paper.link}`)
  ab('wait 1500')
  const abstractText = abEval(
    `document.querySelectorAll('h2')[0]?.nextElementSibling?.textContent || ''`,
    OUTPUT_DIR
  )
  if (abstractText) {
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
steps.push({ step: 'fetch_abstracts', status: 'success', detail: `${newPapers.length} abstracts fetched` })

// ── Step 3: Download thumbnails (only for new papers) ───────────────────────

log('Step 3/4: Downloading thumbnails...')
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

for (const paper of newPapers) {
  const thumbPath = resolve(OUTPUT_DIR, `${paper.arxivId}.png`)
  if (existsSync(thumbPath)) {
    log(`  ⏭ ${paper.arxivId}.png already exists`)
    continue
  }
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

// ── Step 4: Post to X.com ────────────────────────────────────────────────────

log('Step 4/4: Posting to X.com...')

function composeTweet(paper: Paper): string {
  // Main post: title + abstract + upvotes. NO links, NO hashtags.
  // Links go in self-reply to avoid X.com link throttling.
  let tweet = `${paper.title}\n\n${paper.abstract}\n\n${paper.upvotes} upvotes on HuggingFace Daily Papers`

  if (tweet.length > 280) {
    // Shorten abstract to fit
    const target = 280 - (paper.title.length + 50) // 50 = upvotes line + newlines
    const shortAbstract = paper.abstract.slice(0, Math.max(target, 20)) + '...'
    tweet = `${paper.title}\n\n${shortAbstract}\n\n${paper.upvotes} upvotes on HuggingFace Daily Papers`
  }

  if (tweet.length > 280) {
    // Drop abstract entirely
    tweet = `${paper.title}\n\n${paper.upvotes} upvotes on HuggingFace Daily Papers`
  }

  return tweet
}

/**
 * Extract the URL of the just-posted tweet from the home timeline.
 * After posting, own tweet appears in timeline with "Now" timestamp.
 * We look for status links matching our username.
 */
function getPostUrl(): string | null {
  const js = `
    const links = document.querySelectorAll('a[href*="/${xUsername}/status/"]');
    const urls = Array.from(links).map(a => a.href)
      .filter(h => h.match(/\\/${xUsername}\\/status\\/\\d+$/));
    // Return the one with highest status ID (most recent)
    urls.sort((a, b) => {
      const idA = BigInt(a.split('/status/')[1] || '0');
      const idB = BigInt(b.split('/status/')[1] || '0');
      return idB > idA ? 1 : idB < idA ? -1 : 0;
    });
    JSON.stringify(urls[0] || null);
  `
  const result = abEval(js, OUTPUT_DIR)
  if (result && result !== 'null' && result.includes('/status/')) {
    return result
  }
  return null
}

/**
 * Navigate to a tweet and post a reply with the paper link.
 */
function replyWithLink(tweetUrl: string, paperLink: string): boolean {
  log(`  Replying to ${tweetUrl} with link...`)
  // Stay in Tab 2 (X.com) — tweet URL is same domain
  switchToX()
  ab(`open ${tweetUrl}`)
  ab('wait 3000')

  const replyText = `Paper: ${paperLink}`

  const textboxRef = findRef('textbox "Post text"')
  if (!textboxRef) {
    log(`  ✗ Could not find reply textbox`)
    return false
  }

  const escapedReply = replyText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  ab(`fill ${textboxRef} "${escapedReply}"`)
  ab('wait 1000')

  // Click Reply button (not "Post")
  for (let attempt = 1; attempt <= 3; attempt++) {
    const snap = ab('snapshot -i -c')
    const replyMatch = snap.match(/button "Reply" \[ref=(e\d+)\]/)
    if (!replyMatch) {
      log(`  ✗ Reply attempt ${attempt}: Reply button not found`)
      ab('wait 2000')
      continue
    }
    ab(`click @${replyMatch[1]}`)
    ab('wait 4000')

    // Verify reply was sent (textbox should be empty or contain placeholder)
    const verify = ab('snapshot -i -c -s \'[role="textbox"]\'')
    if (!verify.includes('Paper:')) {
      log(`  ✓ Reply posted successfully`)
      return true
    }
    log(`  ⟳ Reply attempt ${attempt}: text still present, retrying...`)
  }

  log(`  ✗ Reply failed after 3 attempts`)
  return false
}

function postOnePaper(paper: Paper): 'success' | 'failed' {
  const thumbPath = resolve(OUTPUT_DIR, `${paper.arxivId}.png`)
  const tweet = composeTweet(paper)
  log(`  Posting (${tweet.length} chars): ${paper.title.slice(0, 50)}...`)

  // ── Step A: Switch to X.com tab and open home timeline ──
  switchToX()
  ab('open https://x.com/home')
  ab('wait 2000')

  if (existsSync(thumbPath)) {
    ab(`upload 'input[type="file"]' "${thumbPath}"`)
    ab('wait 3000')
  }

  const textboxRef = findRef('textbox "Post text"')
  if (!textboxRef) {
    log(`  ✗ Could not find textbox`)
    return 'failed'
  }
  const escapedTweet = tweet.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  ab(`fill ${textboxRef} "${escapedTweet}"`)
  ab('wait 1000')

  // ── Step B: Click Post button ──
  let posted = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    const snap = ab('snapshot -i -c')
    const postMatch = snap.match(/button "Post" \[ref=(e\d+)\]/)
    if (!postMatch) {
      log(`  ✗ Attempt ${attempt}: Post button not found`)
      ab('wait 2000')
      continue
    }
    ab(`click @${postMatch[1]}`)
    ab('wait 5000')

    const verify = ab('snapshot -i -c -s \'[role="textbox"]\'')
    if (!verify.includes(paper.title.slice(0, 20))) {
      log(`  ✓ Main tweet posted`)
      posted = true
      break
    }
    log(`  ⟳ Attempt ${attempt}: text still in compose, retrying...`)
  }

  if (!posted) {
    log(`  ✗ Main tweet failed after 3 attempts`)
    return 'failed'
  }

  // ── Step C: Extract post URL from timeline ──
  ab('wait 2000')
  const postUrl = getPostUrl()
  if (!postUrl) {
    log(`  ⚠ Could not extract post URL — tweet posted but reply skipped`)
    return 'success' // Main tweet succeeded even if we can't reply
  }
  log(`  → Post URL: ${postUrl}`)

  // ── Step D: Self-reply with paper link ──
  const replied = replyWithLink(postUrl, paper.link)
  if (!replied) {
    log(`  ⚠ Self-reply failed — main tweet is still posted`)
  }

  return 'success'
}

// Create X.com tab (HF tab stays untouched)
ab('tab new')
ab('wait 500')
tabX = getActiveTabIndex()
ab('open https://x.com/home')
ab('wait 2000')
log(`X.com tab ready (HF=tab ${tabHF}, X=tab ${tabX})`)

for (const paper of papers) {
  if (paper.skippedDedup) {
    log(`  ⏭ Skipping (already posted): ${paper.arxivId} — ${paper.title.slice(0, 40)}...`)
    skippedCount++
    continue
  }

  // ── Checkpoint: honor stop signal from agent ──
  if (checkWorkflowStopped()) {
    log(`  ⏸ Workflow stopped by external signal — stopping after ${postedCount} posts`)
    break
  }

  const result = postOnePaper(paper)
  if (result === 'success') {
    paper.posted = true
    postedCount++
    // Record to dedup store immediately
    postedStore.papers.push({
      arxivId: paper.arxivId,
      title: paper.title,
      postedAt: new Date().toISOString(),
      hfDate,
    })
    savePosted(postedStore)
  } else {
    failedCount++
  }

  // Pause between posts
  if (result === 'success') {
    ab('wait 3000')
  }
}

// Close X.com tab and switch back to HF tab
switchToX()
ab('tab close')
ab('wait 300')
switchToHF()
log('X.com tab closed, back to HF tab')

if (failedCount > 0) {
  steps.push({ step: 'post_to_x', status: 'failed', detail: `posted=${postedCount} skipped=${skippedCount} failed=${failedCount}` })
} else {
  steps.push({ step: 'post_to_x', status: 'success', detail: `posted=${postedCount} skipped=${skippedCount}` })
}

// ── Save daily data JSON ────────────────────────────────────────────────────

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
    posted: p.posted,
    skippedDedup: p.skippedDedup,
  })),
}
writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
log(`Data saved to ${dataPath}`)

// ── Output ───────────────────────────────────────────────────────────────────

outputResult(hfDate)
