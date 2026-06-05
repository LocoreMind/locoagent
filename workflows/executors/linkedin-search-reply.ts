#!/usr/bin/env bun
/**
 * linkedin-search-reply.ts
 * Workflow: Search LinkedIn for a keyword → read posts → generate AI comment → post comment.
 *
 * Steps:
 *   1. Search LinkedIn for keyword (Latest), extract top N post URLs via control menu → copy link
 *   2. For each post: navigate to post detail page, read content via JS eval
 *   3. Call DeepSeek v4 flash API to generate comment text
 *   4. Post comment via browser automation (fill textbox → click Comment → verify)
 *
 * LinkedIn-specific notes (from linkedin-playbook.md):
 *   - Post URLs are NOT in DOM links — must use "Open control menu" → "Copy link to post" → clipboard read
 *   - Comment textbox: textbox "Text editor for creating comment" (always visible on post detail page)
 *   - Comment submit button: button "Comment" next to button "Show Emoji Picker" + button "Share photo"
 *     (NOT the engagement bar button "Comment" which just expands the section)
 *   - Compose modal is in iframe (--all-frames), but comments are NOT in iframe
 *   - Use `fill` on contenteditable comment box (same as X.com)
 *
 * Config is passed as --config JSON from workflow-engine.ts
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const COMMENTED_PATH = resolve(ROOT, 'workflows', '.tmp', 'linkedin-commented-posts.json')
const STATE_PATH = resolve(ROOT, 'workflows', 'state.json')
const ENV_PATH = resolve(ROOT, '.env')

// ── Config ───────────────────────────────────────────────────────────────────

interface Config {
  searchQuery: string
  maxPosts: number
  cdpPort: number
  platform?: string
  outputDir?: string
  commentSystemPrompt?: string
}

const configArg = process.argv.find((_, i, a) => a[i - 1] === '--config')
if (!configArg) {
  console.error('Missing --config argument')
  process.exit(2)
}
const config: Config = JSON.parse(configArg)
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

// ── Commented-posts dedup store ──────────────────────────────────────────────

interface CommentedEntry {
  postUrl: string
  commentedAt: string
  searchQuery: string
}

interface CommentedStore {
  version: number
  description: string
  posts: CommentedEntry[]
}

function loadCommented(): CommentedStore {
  if (!existsSync(COMMENTED_PATH)) {
    return { version: 1, description: 'Dedup: tracks LinkedIn posts already commented on', posts: [] }
  }
  return JSON.parse(readFileSync(COMMENTED_PATH, 'utf-8')) as CommentedStore
}

function saveCommented(store: CommentedStore): void {
  const dir = dirname(COMMENTED_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(COMMENTED_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}

const commentedStore = loadCommented()
const commentedUrls = new Set(commentedStore.posts.map(p => p.postUrl))

// ── Workflow state checkpoint ──────────────────────────────────────────────

function checkWorkflowStopped(): boolean {
  try {
    if (!existsSync(STATE_PATH)) return false
    const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
    const ws = state.workflows?.['linkedin-search-reply']
    if (!ws) return false
    return ws.status === 'stopped'
  } catch (_) {}
  return false
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ab(cmd: string, timeout = 30000): string {
  try {
    return execSync(`agent-browser --cdp ${config.cdpPort}${sessionFlag} ${cmd}`, {
      encoding: 'utf-8',
      timeout,
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

function sleep(ms: number): void {
  ab(`wait ${ms}`)
}

// ── Types & State ────────────────────────────────────────────────────────────

interface PostInfo {
  url: string
  author: string
  content: string
  commentText: string
  commented: boolean
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
let commentedCount = 0
let skippedCount = 0
let failedCount = 0

function log(msg: string): void {
  console.error(`[linkedin-search-reply] ${msg}`)
}

function outputResult() {
  const completedSteps = steps.filter(s => s.status === 'success').length
  const result = {
    stepsCompleted: completedSteps,
    stepsTotal: TOTAL_STEPS,
    searchQuery: config.searchQuery,
    posts: posts.map(p => ({
      url: p.url,
      author: p.author,
      commented: p.commented,
      skippedDedup: p.skippedDedup,
      commentText: p.commentText?.slice(0, 100),
    })),
    commented: commentedCount,
    skipped: skippedCount,
    failed: failedCount,
    steps,
  }
  console.log(JSON.stringify(result))
}

// ── DeepSeek API call ──────────────────────────────────────────────────────

async function callDeepSeek(postContent: string): Promise<string> {
  const systemPrompt = config.commentSystemPrompt ??
    'You are a knowledgeable AI researcher and practitioner on LinkedIn. Read the following LinkedIn post and write a thoughtful, professional comment (2-4 sentences, under 500 characters). Add genuine insight or a related perspective. Be conversational and specific to the post content. Do NOT use hashtags or emojis. Reply in the same language as the post.'

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here is the LinkedIn post to comment on:\n\n${postContent}\n\nWrite your comment:` },
    ],
    max_tokens: 300,
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

// ── Step 1: Search LinkedIn and extract post URLs ────────────────────────────
// LinkedIn search results do NOT have direct post URLs in the DOM.
// Strategy: use control menu → "Copy link to post" → clipboard read for each post.

async function main() {
  const OUTPUT_DIR = resolve(ROOT, 'workflows', config.outputDir ?? '.tmp', 'linkedin-search-reply')

  log('Step 1/4: Searching LinkedIn...')
  const query = encodeURIComponent(config.searchQuery)
  // Search for posts, sorted by Latest (date_posted)
  ab(`open "https://www.linkedin.com/search/results/content/?keywords=${query}&origin=SWITCH_SEARCH_VERTICAL&sortBy=%22date_posted%22"`, 60000)
  // Wait for network idle to handle slow connections
  ab('wait --load networkidle')
  sleep(3000)

  // Verify search loaded — retry with extra wait if needed
  let title = ab('get title')
  if (!title.includes('Search') && !title.includes('LinkedIn')) {
    log('Page not ready, waiting longer...')
    sleep(5000)
    title = ab('get title')
  }
  if (!title.includes('Search') && !title.includes('LinkedIn')) {
    log('Search page did not load properly')
    steps.push({ step: 'search', status: 'failed', detail: 'page did not load' })
    outputResult()
    process.exit(1)
  }

  // Get snapshot to find post control menus
  const searchSnap = ab('snapshot -i -c')
  if (!searchSnap) {
    log('Failed to get search results snapshot')
    steps.push({ step: 'search', status: 'failed', detail: 'snapshot failed' })
    outputResult()
    process.exit(1)
  }

  // Find all "Open control menu for post by <Name>" buttons
  const controlMenuPattern = /button "Open control menu for post by (.+?)" \[expanded=false, ref=(e\d+)\]/g
  const controlMenus: Array<{ author: string; ref: string }> = []
  let match: RegExpExecArray | null
  while ((match = controlMenuPattern.exec(searchSnap)) !== null) {
    controlMenus.push({ author: match[1]!, ref: match[2]! })
  }

  log(`Found ${controlMenus.length} posts in search results`)

  // Limit to maxPosts
  const targetAuthors = controlMenus.slice(0, config.maxPosts).map(m => m.author)

  // Extract URLs by clicking control menu → Copy link to post → clipboard read
  // NOTE: After each copy, the DOM changes (toast notification, refs shift).
  // We must re-snapshot and find the control menu by author name each time.
  const postUrls: Array<{ url: string; author: string }> = []
  for (const author of targetAuthors) {
    // Re-snapshot to get fresh refs (they change after each toast/copy action)
    const freshSnap = ab('snapshot -i -c')
    const menuPattern = new RegExp(`button "Open control menu for post by ${author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" \\[expanded=false, ref=(e\\d+)\\]`)
    const menuMatch = freshSnap.match(menuPattern)
    if (!menuMatch) {
      log(`  Could not find control menu for ${author} (ref shifted)`)
      continue
    }

    // Scroll into view and click control menu
    ab(`scrollintoview @${menuMatch[1]}`)
    sleep(500)
    ab(`click @${menuMatch[1]}`)
    sleep(1000)

    // Find and click "Copy link to post"
    const menuSnap = ab('snapshot -i -c')
    const copyMatch = menuSnap.match(/menuitem "Copy link to post" \[ref=(e\d+)\]/)
    if (!copyMatch) {
      log(`  Could not find "Copy link to post" for ${author}`)
      ab('press Escape')
      sleep(500)
      continue
    }

    ab(`click @${copyMatch[1]}`)
    sleep(1500)

    // Read URL from clipboard
    const url = ab('clipboard read')
    if (url && url.startsWith('https://www.linkedin.com/')) {
      // Strip UTM params for cleaner dedup key
      const cleanUrl = url.split('?')[0]!
      postUrls.push({ url: cleanUrl, author })
      log(`  OK ${author}: ${cleanUrl.slice(-40)}`)
    } else {
      log(`  FAIL ${author}: clipboard read failed`)
    }

    // Dismiss toast notification by clicking Close or pressing Escape
    // The toast has: button "Close" [ref=eNN]
    const toastSnap = ab('snapshot -i -c')
    const closeMatch = toastSnap.match(/generic "Link copied.*?"[\s\S]*?button "Close" \[ref=(e\d+)\]/)
    if (closeMatch) {
      ab(`click @${closeMatch[1]}`)
    } else {
      ab('press Escape')
    }
    sleep(500)
  }

  posts = postUrls.map(p => ({
    url: p.url,
    author: p.author,
    content: '',
    commentText: '',
    commented: false,
    skippedDedup: commentedUrls.has(p.url),
  }))

  const newPosts = posts.filter(p => !p.skippedDedup)
  log(`Collected ${posts.length} post URLs, ${newPosts.length} new (${posts.length - newPosts.length} already commented)`)
  steps.push({ step: 'search', status: 'success', detail: `${posts.length} selected, ${newPosts.length} new` })

  if (newPosts.length === 0) {
    log('No new posts to comment on.')
    steps.push({ step: 'read_posts', status: 'skipped' })
    steps.push({ step: 'generate_comments', status: 'skipped' })
    steps.push({ step: 'post_comments', status: 'skipped' })
    skippedCount = posts.length
    outputResult()
    process.exit(0)
  }

  // ── Step 2: Read post content ──────────────────────────────────────────────

  log('Step 2/4: Reading post content...')
  for (const post of newPosts) {
    ab(`open "${post.url}"`, 60000)
    ab('wait --load networkidle')
    sleep(2000)

    // Read full post text via JS eval (most reliable on LinkedIn's SPA)
    const postText = abEval(
      `(() => {
        // Try to get the main post content from the feed post region
        const region = document.querySelector('[data-component-type="LazyColumn"]') ||
                       document.querySelector('[role="main"]') ||
                       document.querySelector('.feed-shared-update-v2');
        if (!region) return '';
        // Get text content, clean up whitespace
        return region.innerText.slice(0, 2000);
      })()`,
      OUTPUT_DIR
    )

    if (postText && postText.length > 20) {
      post.content = postText.slice(0, 1500) // cap for API
      log(`  OK ${post.author}: ${post.content.slice(0, 60).replace(/\n/g, ' ')}...`)
    } else {
      // Fallback: try snapshot text
      const snap = ab('snapshot -c')
      const cleaned = snap
        .replace(/\[ref=e\d+\]/g, '')
        .replace(/\x1b\[\d*m/g, '')
        .trim()
      if (cleaned.length > 50) {
        post.content = cleaned.slice(0, 1500)
        log(`  OK (fallback) ${post.author}: ${post.content.slice(0, 60).replace(/\n/g, ' ')}...`)
      } else {
        post.content = ''
        log(`  FAIL ${post.author}: could not read content`)
      }
    }
  }
  steps.push({ step: 'read_posts', status: 'success', detail: `${newPosts.length} posts read` })

  // ── Step 3: Generate comments via DeepSeek ──────────────────────────────────

  log('Step 3/4: Generating comments via DeepSeek...')
  for (const post of newPosts) {
    if (!post.content) {
      post.commentText = ''
      log(`  SKIP ${post.author}: no content`)
      continue
    }
    try {
      const comment = await callDeepSeek(post.content)
      post.commentText = comment.slice(0, 1000) // LinkedIn allows longer comments than X
      log(`  OK ${post.author}: "${post.commentText.slice(0, 60)}..."`)
    } catch (e: any) {
      log(`  FAIL ${post.author}: ${e.message}`)
      post.commentText = ''
    }
  }
  const generated = newPosts.filter(p => p.commentText).length
  steps.push({ step: 'generate_comments', status: generated > 0 ? 'success' : 'failed', detail: `${generated}/${newPosts.length} comments generated` })

  // ── Step 4: Post comments ──────────────────────────────────────────────────
  // LinkedIn comment flow:
  //   1. Navigate to post detail page
  //   2. Find textbox "Text editor for creating comment" (always visible)
  //   3. Fill text using `fill`
  //   4. Find the CORRECT "Comment" button (next to "Show Emoji Picker" + "Share photo")
  //   5. Click to submit
  //   6. Verify by checking for own comment in snapshot

  log('Step 4/4: Posting comments...')
  for (const post of posts) {
    if (post.skippedDedup) {
      skippedCount++
      log(`  SKIP (already commented): ${post.author}`)
      continue
    }

    if (!post.commentText) {
      failedCount++
      post.error = 'no comment text generated'
      log(`  SKIP (no comment text): ${post.author}`)
      continue
    }

    // Check stop signal
    if (checkWorkflowStopped()) {
      log(`  STOP: Workflow stopped by external signal after ${commentedCount} comments`)
      break
    }

    // Navigate to the post detail page
    ab(`open "${post.url}"`, 60000)
    ab('wait --load networkidle')
    sleep(2000)

    // Find the comment textbox
    const snap1 = ab('snapshot -i -c')
    const textboxMatch = snap1.match(/textbox "Text editor for creating comment" \[ref=(e\d+)\]/)
    if (!textboxMatch) {
      log(`  FAIL ${post.author}: comment textbox not found`)
      failedCount++
      post.error = 'comment textbox not found'
      continue
    }
    const textboxRef = `@${textboxMatch[1]}`

    // Fill the comment text
    const escapedComment = post.commentText.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    ab(`fill ${textboxRef} "${escapedComment}"`)
    sleep(1500)

    // Snapshot to find the submit Comment button
    // There are multiple "Comment" buttons — we need the one next to "Show Emoji Picker" + "Share photo"
    const snap2 = ab('snapshot -i -c')

    // Strategy: find button "Comment" that appears AFTER button "Share photo" in the snapshot
    // The submit button appears as: button "Show Emoji Picker" ... button "Share photo" ... button "Comment"
    // The engagement bar button appears as: button "Comment" ... button "Repost"
    let submitRef = ''
    const sharePhotoIdx = snap2.indexOf('button "Share photo"')
    if (sharePhotoIdx !== -1) {
      // Find the first button "Comment" AFTER "Share photo"
      const afterShare = snap2.slice(sharePhotoIdx)
      const submitMatch = afterShare.match(/button "Comment" \[ref=(e\d+)\]/)
      if (submitMatch) {
        submitRef = `@${submitMatch[1]}`
      }
    }

    if (!submitRef) {
      // Fallback: try to find any Comment button that is NOT the engagement bar one
      // The engagement bar Comment button appears before the textbox
      const allCommentBtns = [...snap2.matchAll(/button "Comment" \[ref=(e\d+)\]/g)]
      if (allCommentBtns.length > 1) {
        // Last one is typically the submit button
        submitRef = `@${allCommentBtns[allCommentBtns.length - 1]![1]}`
      } else if (allCommentBtns.length === 1) {
        submitRef = `@${allCommentBtns[0]![1]}`
      }
    }

    if (!submitRef) {
      log(`  FAIL ${post.author}: Comment submit button not found`)
      failedCount++
      post.error = 'submit button not found'
      continue
    }

    // Click the Comment submit button
    ab(`click ${submitRef}`)
    sleep(4000)

    // Verify comment was posted by checking for own name in the comments
    const verifySnap = ab('snapshot -i -c')
    const verified = verifySnap.includes('Shijian Ma') && verifySnap.includes("View more options for Shijian Ma's comment")

    // Also check if textbox is now empty (comment was consumed)
    const textboxEmpty = !verifySnap.includes(post.commentText.slice(0, 30))

    if (verified || textboxEmpty) {
      log(`  OK ${post.author}: comment posted${verified ? ' (verified)' : ' (textbox cleared)'}`)
      post.commented = true
      commentedCount++

      // Save to dedup store immediately
      commentedStore.posts.push({
        postUrl: post.url,
        commentedAt: new Date().toISOString(),
        searchQuery: config.searchQuery,
      })
      saveCommented(commentedStore)
    } else {
      log(`  FAIL ${post.author}: comment may not have posted`)
      failedCount++
      post.error = 'verification failed'
    }

    // Pause between comments (LinkedIn rate limiting is aggressive)
    sleep(3000)
  }

  if (failedCount > 0) {
    steps.push({ step: 'post_comments', status: 'failed', detail: `commented=${commentedCount} skipped=${skippedCount} failed=${failedCount}` })
  } else {
    steps.push({ step: 'post_comments', status: 'success', detail: `commented=${commentedCount} skipped=${skippedCount}` })
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  outputResult()
}

main().catch(e => {
  console.error(`[linkedin-search-reply] Fatal error: ${e.message}`)
  outputResult()
  process.exit(1)
})
