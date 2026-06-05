#!/usr/bin/env bun
/**
 * x-search-reply.ts
 * Workflow: Search X.com for a keyword → read posts → generate AI reply → post reply.
 *
 * Steps:
 *   1. Search X.com for keyword on Latest tab, extract top N post URLs
 *   2. For each post: read content via browser snapshot
 *   3. Call DeepSeek v4 flash API to generate reply text
 *   4. Post reply via browser automation (fill textbox → click Reply → verify)
 *
 * Config is passed as --config JSON from workflow-engine.ts
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const REPLIED_PATH = resolve(ROOT, 'workflows', '.tmp', 'replied-posts.json')
const STATE_PATH = resolve(ROOT, 'workflows', 'state.json')
const ENV_PATH = resolve(ROOT, '.env')

// ── Config ───────────────────────────────────────────────────────────────────

interface Config {
  searchQuery: string
  maxPosts: number
  cdpPort: number
  platform?: string
  xUsername?: string
  outputDir?: string
  replySystemPrompt?: string
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)
const xUsername = config.xUsername ?? 'mashijiann'
const sessionFlag = config.platform && config.platform !== 'x' ? ` --session ${config.platform}` : ''

// ── Load .env for DeepSeek API ──────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  if (!existsSync(ENV_PATH)) return env
  const lines = readFileSync(ENV_PATH, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    env[key] = val
  }
  return env
}

const envVars = loadEnv()
const DEEPSEEK_API_KEY = envVars['OPENAI_API_KEY'] ?? ''
const DEEPSEEK_BASE_URL = envVars['OPENAI_BASE_URL'] ?? 'https://api.deepseek.com'
const DEEPSEEK_MODEL = envVars['OPENAI_MODEL'] ?? 'deepseek-v4-flash'

if (!DEEPSEEK_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env')
  process.exit(2)
}

// ── Replied-posts dedup store ──────────────────────────────────────────────

interface RepliedEntry {
  postUrl: string
  repliedAt: string
  searchQuery: string
}

interface RepliedStore {
  version: number
  description: string
  posts: RepliedEntry[]
}

function loadReplied(): RepliedStore {
  if (!existsSync(REPLIED_PATH)) {
    return { version: 1, description: 'Dedup: tracks posts already replied to on X.com', posts: [] }
  }
  return JSON.parse(readFileSync(REPLIED_PATH, 'utf-8')) as RepliedStore
}

function saveReplied(store: RepliedStore): void {
  const dir = dirname(REPLIED_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(REPLIED_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

const repliedStore = loadReplied()
const repliedUrls = new Set(repliedStore.posts.map(p => p.postUrl))

// ── Workflow state checkpoint ──────────────────────────────────────────────

function checkWorkflowStopped(): boolean {
  try {
    if (!existsSync(STATE_PATH)) return false
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
    const ws = state.workflows?.['x-search-reply']
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

interface PostInfo {
  url: string
  content: string
  replyText: string
  replied: boolean
  skippedDedup: boolean
  error?: string
}

interface StepResult {
  step: string
  status: 'success' | 'failed' | 'skipped'
  detail?: string
}

const steps: StepResult[] = []
const TOTAL_STEPS = 4
let posts: PostInfo[] = []
let repliedCount = 0
let skippedCount = 0
let failedCount = 0

function log(msg: string): void {
  console.error(`[x-search-reply] ${msg}`)
}

function outputResult() {
  const completedSteps = steps.filter(s => s.status === 'success').length
  const result = {
    stepsCompleted: completedSteps,
    stepsTotal: TOTAL_STEPS,
    searchQuery: config.searchQuery,
    posts: posts.map(p => ({
      url: p.url,
      replied: p.replied,
      skippedDedup: p.skippedDedup,
      replyText: p.replyText?.slice(0, 100),
    })),
    replied: repliedCount,
    skipped: skippedCount,
    failed: failedCount,
    steps,
  }
  console.log(JSON.stringify(result))
}

// ── DeepSeek API call ──────────────────────────────────────────────────────

async function callDeepSeek(postContent: string): Promise<string> {
  const systemPrompt = config.replySystemPrompt ??
    'You are a knowledgeable AI enthusiast on X.com. Write a short, thoughtful reply (1-2 sentences, under 200 characters). Be conversational, add value. No hashtags or emojis. Reply in the same language as the post.'

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here is the X.com post to reply to:\n\n${postContent}\n\nWrite your reply:` },
    ],
    max_tokens: 256,
    temperature: 0.8,
  }

  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`DeepSeek API error ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json() as any
  const content = data.choices?.[0]?.message?.content ?? ''
  return content.trim()
}

// ── Step 1: Search X.com and extract post URLs ─────────────────────────────

async function main() {
  const OUTPUT_DIR = resolve(ROOT, 'workflows', config.outputDir ?? '.tmp', 'x-search-reply')

  log('Step 1/4: Searching X.com...')
  const query = encodeURIComponent(config.searchQuery)
  ab(`open "https://x.com/search?q=${query}&src=typed_query&f=live"`)
  ab('wait 3000')

  // Extract post URLs
  const urlsJson = abEval(
    `JSON.stringify(
      [...new Set(
        Array.from(document.querySelectorAll('a[href*="/status/"]'))
          .map(a => a.href)
          .filter(h => h.match(/\\/status\\/\\d+$/) && !h.includes('/photo/') && !h.includes('/analytics'))
      )]
    )`,
    OUTPUT_DIR
  )

  let postUrls: string[] = []
  try {
    postUrls = JSON.parse(urlsJson) as string[]
  } catch (_) {
    log('Failed to parse post URLs from search results')
  }

  // Filter out own posts
  postUrls = postUrls.filter(u => !u.includes(`/${xUsername}/status/`))

  // Scroll for more if needed
  if (postUrls.length < config.maxPosts) {
    ab('scroll down 3')
    ab('wait 2000')
    const moreJson = abEval(
      `JSON.stringify(
        [...new Set(
          Array.from(document.querySelectorAll('a[href*="/status/"]'))
            .map(a => a.href)
            .filter(h => h.match(/\\/status\\/\\d+$/) && !h.includes('/photo/') && !h.includes('/analytics'))
        )]
      )`,
      OUTPUT_DIR
    )
    try {
      const moreUrls = JSON.parse(moreJson) as string[]
      for (const u of moreUrls) {
        if (!postUrls.includes(u) && !u.includes(`/${xUsername}/status/`)) {
          postUrls.push(u)
        }
      }
    } catch (_) {}
  }

  // Deduplicate by status ID (keep unique status IDs)
  const seenIds = new Set<string>()
  const uniqueUrls: string[] = []
  for (const url of postUrls) {
    const match = url.match(/\/status\/(\d+)$/)
    if (match && !seenIds.has(match[1]!)) {
      seenIds.add(match[1]!)
      uniqueUrls.push(url)
    }
  }
  postUrls = uniqueUrls.slice(0, config.maxPosts)

  posts = postUrls.map(url => ({
    url,
    content: '',
    replyText: '',
    replied: false,
    skippedDedup: repliedUrls.has(url),
  }))

  const newPosts = posts.filter(p => !p.skippedDedup)
  log(`Found ${uniqueUrls.length} posts, selected ${posts.length}, ${newPosts.length} new (${posts.length - newPosts.length} already replied)`)
  steps.push({ step: 'search', status: 'success', detail: `${posts.length} selected, ${newPosts.length} new` })

  if (newPosts.length === 0) {
    log('No new posts to reply to.')
    steps.push({ step: 'read_posts', status: 'skipped' })
    steps.push({ step: 'generate_replies', status: 'skipped' })
    steps.push({ step: 'post_replies', status: 'skipped' })
    skippedCount = posts.length
    outputResult()
    process.exit(0)
  }

  // ── Step 2: Read post content ──────────────────────────────────────────────

  log('Step 2/4: Reading post content...')
  for (const post of newPosts) {
    ab(`open ${post.url}`)
    ab('wait 2000')

    // Read the article content from the detail page
    const articleSnap = ab("snapshot -i -c -s 'article'")
    if (articleSnap) {
      // Extract text content, strip ref tags and clean up
      const cleaned = articleSnap
        .replace(/\[ref=e\d+\]/g, '')
        .replace(/\x1b\[\d*m/g, '')
        .trim()
      post.content = cleaned.slice(0, 1000) // cap at 1000 chars for API
      log(`  OK ${post.url.split('/status/')[1]}: ${post.content.slice(0, 60)}...`)
    } else {
      post.content = ''
      log(`  FAIL ${post.url.split('/status/')[1]}: could not read content`)
    }
  }
  steps.push({ step: 'read_posts', status: 'success', detail: `${newPosts.length} posts read` })

  // ── Step 3: Generate replies via DeepSeek ──────────────────────────────────

  log('Step 3/4: Generating replies via DeepSeek...')
  for (const post of newPosts) {
    if (!post.content) {
      post.replyText = ''
      log(`  SKIP ${post.url.split('/status/')[1]}: no content`)
      continue
    }
    try {
      const reply = await callDeepSeek(post.content)
      // Ensure reply fits tweet length
      post.replyText = reply.slice(0, 280)
      log(`  OK ${post.url.split('/status/')[1]}: "${post.replyText.slice(0, 60)}..."`)
    } catch (e: any) {
      log(`  FAIL ${post.url.split('/status/')[1]}: ${e.message}`)
      post.replyText = ''
    }
  }
  const generated = newPosts.filter(p => p.replyText).length
  steps.push({ step: 'generate_replies', status: generated > 0 ? 'success' : 'failed', detail: `${generated}/${newPosts.length} replies generated` })

  // ── Step 4: Post replies ──────────────────────────────────────────────────

  log('Step 4/4: Posting replies...')
  for (const post of posts) {
    if (post.skippedDedup) {
      skippedCount++
      log(`  SKIP (already replied): ${post.url.split('/status/')[1]}`)
      continue
    }

    if (!post.replyText) {
      failedCount++
      post.error = 'no reply text generated'
      log(`  SKIP (no reply text): ${post.url.split('/status/')[1]}`)
      continue
    }

    // Check stop signal
    if (checkWorkflowStopped()) {
      log(`  STOP: Workflow stopped by external signal after ${repliedCount} replies`)
      break
    }

    // Navigate to the post detail page
    ab(`open ${post.url}`)
    ab('wait 2000')

    // Find the reply textbox
    const textboxSnap = ab("snapshot -i -c -s '[role=\"textbox\"]'")
    const textboxMatch = textboxSnap.match(/textbox "Post text".*?\[ref=(e\d+)\]/)
    if (!textboxMatch) {
      log(`  FAIL ${post.url.split('/status/')[1]}: textbox not found`)
      failedCount++
      post.error = 'textbox not found'
      continue
    }
    const textboxRef = `@${textboxMatch[1]}`

    // Fill the reply
    const escapedReply = post.replyText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    ab(`fill ${textboxRef} "${escapedReply}"`)
    ab('wait 1000')

    // Scroll Reply button into view (it can be below the viewport on long posts)
    abEval(
      `(() => { const btn = document.querySelector('button[data-testid="tweetButtonInline"]'); if (btn) btn.scrollIntoView({ block: "center", behavior: "instant" }); })()`,
      OUTPUT_DIR
    )
    ab('wait 500')

    // Click Reply button (retry up to 3 times)
    let posted = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      const snap = ab('snapshot -i -c')
      const replyBtnMatch = snap.match(/button "Reply" \[ref=(e\d+)\]/)
      if (!replyBtnMatch) {
        log(`  Attempt ${attempt}: Reply button not found`)
        ab('wait 2000')
        continue
      }
      ab(`click @${replyBtnMatch[1]}`)
      ab('wait 4000')

      // Verify reply was sent (textbox should be empty)
      const verify = ab("snapshot -i -c -s '[role=\"textbox\"]'")
      if (!verify.includes(post.replyText.slice(0, 20))) {
        log(`  OK ${post.url.split('/status/')[1]}: reply posted`)
        posted = true
        break
      }
      log(`  Attempt ${attempt}: text still present, retrying...`)

      // Re-scroll Reply button into view before next attempt
      abEval(
        `(() => { const btn = document.querySelector('button[data-testid="tweetButtonInline"]'); if (btn) btn.scrollIntoView({ block: "center", behavior: "instant" }); })()`,
        OUTPUT_DIR
      )
      ab('wait 500')
    }

    if (posted) {
      post.replied = true
      repliedCount++
      // Save to dedup store immediately
      repliedStore.posts.push({
        postUrl: post.url,
        repliedAt: new Date().toISOString(),
        searchQuery: config.searchQuery,
      })
      saveReplied(repliedStore)
    } else {
      failedCount++
      post.error = 'reply button click failed after 3 attempts'
      log(`  FAIL ${post.url.split('/status/')[1]}: reply failed after 3 attempts`)
      // Clear textbox to prevent "Leave site?" dialog blocking subsequent navigations
      abEval(
        `(() => { const el = document.querySelector('[data-testid="tweetTextarea_0"]'); if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('delete'); } })()`,
        OUTPUT_DIR
      )
      ab('wait 500')
    }

    // Pause between replies
    if (posted) {
      ab('wait 3000')
    }
  }

  if (failedCount > 0) {
    steps.push({ step: 'post_replies', status: 'failed', detail: `replied=${repliedCount} skipped=${skippedCount} failed=${failedCount}` })
  } else {
    steps.push({ step: 'post_replies', status: 'success', detail: `replied=${repliedCount} skipped=${skippedCount}` })
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  outputResult()
}

main().catch(e => {
  console.error(`[x-search-reply] Fatal error: ${e.message}`)
  outputResult()
  process.exit(1)
})
