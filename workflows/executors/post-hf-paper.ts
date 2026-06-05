#!/usr/bin/env bun
/**
 * post-hf-paper.ts
 * Pure browser-automation: Post a single HF paper to X.com with image.
 * Main post contains title + abstract + image (no links, no hashtags).
 * Paper link is posted as a self-reply to avoid X.com link throttling.
 *
 * Usage:
 *   bun run workflows/executors/post-hf-paper.ts \
 *     --cdp 9222 \
 *     --title "Paper Title" \
 *     --abstract "Short abstract" \
 *     --upvotes 35 \
 *     --url "https://huggingface.co/papers/xxxx.xxxxx" \
 *     --image "/path/to/thumbnail.png" \
 *     --username mashijiann
 */

import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

// ── Arg parsing ──────────────────────────────────────────────────────────────

function getArg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1 || idx + 1 >= process.argv.length) return ''
  return process.argv[idx + 1]!
}

const cdpPort = getArg('cdp') || '9222'
const platform = getArg('platform')
const sessionFlag = platform && platform !== 'x' ? ` --session ${platform}` : ''
const title = getArg('title')
const abstract = getArg('abstract')
const upvotes = getArg('upvotes')
const paperUrl = getArg('url')
const imagePath = getArg('image')
const xUsername = getArg('username') || 'mashijiann'

if (!title || !paperUrl) {
  console.error('Missing required args: --title, --url')
  process.exit(2)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ab(cmd: string): string {
  try {
    return execSync(`agent-browser --cdp ${cdpPort}${sessionFlag} ${cmd}`, {
      encoding: 'utf-8',
      timeout: 30000,
    }).trim()
  } catch (e: any) {
    console.error(`[ab] Failed: ${cmd}`)
    console.error(e.stderr?.slice(0, 200) || e.message)
    return ''
  }
}

function abEval(js: string): string {
  const evalDir = resolve(tmpdir(), 'post-hf-paper')
  if (!existsSync(evalDir)) mkdirSync(evalDir, { recursive: true })
  const tmpJs = resolve(evalDir, '.eval-tmp.js')
  writeFileSync(tmpJs, js, 'utf-8')
  try {
    let result = execSync(
      `agent-browser --cdp ${cdpPort}${sessionFlag} eval "$(cat '${tmpJs}')"`,
      { encoding: 'utf-8', timeout: 30000 }
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

function log(msg: string): void {
  console.error(`[post-hf-paper] ${msg}`)
}

// ── Compose tweet text (NO links, NO hashtags) ──────────────────────────────

let tweet = `${title}\n\n${abstract}`
if (upvotes) tweet += `\n\n${upvotes} upvotes on HuggingFace Daily Papers`

// Trim to 280 chars if needed
if (tweet.length > 280) {
  const target = 280 - (title.length + 50)
  const shortAbstract = abstract.slice(0, Math.max(target, 20)) + '...'
  tweet = `${title}\n\n${shortAbstract}`
  if (upvotes) tweet += `\n\n${upvotes} upvotes on HuggingFace Daily Papers`
}

// If still too long, drop abstract entirely
if (tweet.length > 280) {
  tweet = title
  if (upvotes) tweet += `\n\n${upvotes} upvotes on HuggingFace Daily Papers`
}

log(`Tweet (${tweet.length} chars):\n${tweet}`)

// ── Step 1: Open X.com home ──────────────────────────────────────────────────

log('Step 1: Opening X.com home...')
ab('open https://x.com/home')
ab('wait 2000')

// ── Step 2: Upload image ─────────────────────────────────────────────────────

if (imagePath) {
  log(`Step 2: Uploading image ${imagePath}...`)
  ab(`upload 'input[type="file"]' "${imagePath}"`)
  ab('wait 3000')
} else {
  log('Step 2: No image, skipping upload')
}

// ── Step 3: Fill text ────────────────────────────────────────────────────────

log('Step 3: Filling tweet text...')
const textboxRef = findRef('textbox "Post text"')
if (!textboxRef) {
  log('ERROR: Could not find Post textbox')
  process.exit(1)
}
ab(`fill ${textboxRef} "${tweet.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
ab('wait 1000')

// ── Step 4: Click Post ───────────────────────────────────────────────────────

log('Step 4: Clicking Post...')

let posted = false
for (let attempt = 1; attempt <= 3; attempt++) {
  const snap = ab('snapshot -i -c')
  const postMatch = snap.match(/button "Post" \[ref=(e\d+)\]/)
  if (!postMatch) {
    log(`Attempt ${attempt}: Could not find Post button`)
    if (attempt === 3) {
      log('ERROR: Post button not found after 3 attempts')
      console.log(JSON.stringify({ status: 'failed', reason: 'post_button_not_found' }))
      process.exit(1)
    }
    ab('wait 2000')
    continue
  }
  const postRef = `@${postMatch[1]}`
  log(`Attempt ${attempt}: Clicking ${postRef}`)
  ab(`click ${postRef}`)
  ab('wait 5000')

  // Verify — compose box should be empty
  const verifySnapshot = ab('snapshot -i -c -s \'[role="textbox"]\'')
  if (!verifySnapshot.includes(title.slice(0, 20))) {
    log('Main tweet posted successfully')
    posted = true
    break
  }
  log(`Attempt ${attempt}: Text still in compose, retrying...`)
  if (attempt === 3) {
    log('FAILED: Text still in compose after 3 attempts')
    console.log(JSON.stringify({ status: 'failed', reason: 'text_still_in_compose' }))
    process.exit(1)
  }
}

if (!posted) {
  log('FAILED: Exhausted retries')
  console.log(JSON.stringify({ status: 'failed', reason: 'exhausted_retries' }))
  process.exit(1)
}

// ── Step 5: Extract post URL from timeline ───────────────────────────────────

log('Step 5: Extracting post URL...')
ab('wait 2000')

const getUrlJs = `
  const links = document.querySelectorAll('a[href*="/${xUsername}/status/"]');
  const urls = Array.from(links).map(a => a.href)
    .filter(h => h.match(/\\/${xUsername}\\/status\\/\\d+$/));
  urls.sort((a, b) => {
    const idA = BigInt(a.split('/status/')[1] || '0');
    const idB = BigInt(b.split('/status/')[1] || '0');
    return idB > idA ? 1 : idB < idA ? -1 : 0;
  });
  JSON.stringify(urls[0] || null);
`

let postUrl = abEval(getUrlJs)
if (!postUrl || postUrl === 'null' || !postUrl.includes('/status/')) {
  log('WARNING: Could not extract post URL — tweet posted but reply skipped')
  console.log(JSON.stringify({ status: 'success', title, url: paperUrl, postUrl: null, replied: false }))
  process.exit(0)
}
log(`Post URL: ${postUrl}`)

// ── Step 6: Self-reply with paper link ───────────────────────────────────────

log('Step 6: Posting self-reply with paper link...')
ab(`open ${postUrl}`)
ab('wait 3000')

const replyText = `Paper: ${paperUrl}`
const replyTextboxRef = findRef('textbox "Post text"')
if (!replyTextboxRef) {
  log('WARNING: Could not find reply textbox — main tweet posted but reply skipped')
  console.log(JSON.stringify({ status: 'success', title, url: paperUrl, postUrl, replied: false }))
  process.exit(0)
}

ab(`fill ${replyTextboxRef} "${replyText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
ab('wait 1000')

let replied = false
for (let attempt = 1; attempt <= 3; attempt++) {
  const snap = ab('snapshot -i -c')
  const replyMatch = snap.match(/button "Reply" \[ref=(e\d+)\]/)
  if (!replyMatch) {
    log(`Reply attempt ${attempt}: Reply button not found`)
    ab('wait 2000')
    continue
  }
  ab(`click @${replyMatch[1]}`)
  ab('wait 4000')

  const verify = ab('snapshot -i -c -s \'[role="textbox"]\'')
  if (!verify.includes('Paper:')) {
    log('Reply posted successfully')
    replied = true
    break
  }
  log(`Reply attempt ${attempt}: text still present, retrying...`)
}

if (!replied) {
  log('WARNING: Self-reply failed — main tweet is still posted')
}

console.log(JSON.stringify({ status: 'success', title, url: paperUrl, postUrl, replied }))
process.exit(0)
