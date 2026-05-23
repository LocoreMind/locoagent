---
description: "TweetClaw OpenClaw source-data playbook for LocoAgent. Covers setup, safe X/Twitter search, reply research, follower export, media checks, monitors, and handoff into browser-based X.com actions."
allowed-tools:
  - Bash
user-invocable: true
---

# TweetClaw Source Workflow

Use this playbook when the user needs structured X/Twitter data before LocoAgent acts in a real browser session.
TweetClaw runs as an OpenClaw plugin and gives the agent a typed source layer for tweet search, reply search, follower export, user lookup, media workflows, monitors, webhooks, direct messages, and approval-gated posting.

Use `/x-com` for browser-side actions after TweetClaw has produced target tweet URLs, account handles, or source briefs.

## Setup

Install the OpenClaw plugin:

```bash
openclaw plugins install @xquik/tweetclaw
```

Configure account-backed access without exposing the secret in prompts:

```bash
openclaw config set plugins.entries.tweetclaw.config.apiKey "$XQUIK_API_KEY"
openclaw config set tools.alsoAllow '["explore", "tweetclaw"]'
openclaw plugins inspect tweetclaw --runtime
openclaw skills info tweetclaw
```

If the user only needs read-only endpoints and has an MPP signing key, configure it instead of an API key:

```bash
openclaw config set plugins.entries.tweetclaw.config.tempoSigningKey "$MPP_SIGNING_KEY"
```

Security rules:

- Never paste API keys, signing keys, cookies, or session material into chat.
- Use environment variables for setup commands.
- Treat TweetClaw write-like requests as approval-gated actions.
- Use LocoAgent's browser session to verify context before liking, replying, following, deleting, or posting.

## Source Brief Pattern

Ask OpenClaw to use TweetClaw first, then pass the output into LocoAgent:

```text
Use TweetClaw to search tweets about "open source AI agents".
Return a JSON source brief with tweet URL, author handle, posted time, text summary, metrics, and why it is worth engaging.
Limit to 10 posts. Exclude duplicates and low-context posts.
Do not post, reply, like, follow, or send direct messages.
```

Expected handoff shape:

```json
{
  "query": "open source AI agents",
  "items": [
    {
      "tweetUrl": "https://x.com/example/status/123",
      "author": "example",
      "summary": "Short factual summary",
      "reason": "Why LocoAgent should inspect it",
      "suggestedAction": "read"
    }
  ]
}
```

Then load `/x-com` and inspect or act on the selected URLs through the real browser:

```text
/x-com open https://x.com/example/status/123, read the thread, and draft one short reply. Do not submit until I approve it.
```

## Common Workflows

### Search Tweets

Use for trend research, target discovery, content sourcing, and conversation triage.

```text
Use TweetClaw to search tweets for "AI agent monitoring".
Return the 10 best candidates with tweet URL, author, text summary, and engagement signals.
Prefer recent posts with clear technical claims.
```

### Search Tweet Replies

Use when the user needs audience objections, support questions, feedback, or giveaway replies.

```text
Use TweetClaw to search replies for this tweet URL: <tweet-url>.
Group replies by question, objection, bug report, praise, and low-quality noise.
Return representative reply URLs and a concise summary per group.
```

### User Lookup

Use before browser-side engagement with a target account.

```text
Use TweetClaw to look up @example.
Return profile metadata, recent activity summary, and whether the account looks relevant to AI agent automation.
Do not follow or message the account.
```

### Follower Export

Use for lead research or community mapping.

```text
Use TweetClaw to export followers for @example.
Return a small candidate list with handle, profile summary, and reason for follow-up.
Do not follow, DM, or post.
```

### Media Workflows

Use when the user needs media evidence before posting, quoting, or replying.

```text
Use TweetClaw to inspect media attached to <tweet-url>.
Return media type, source tweet URL, author, and a short description for each item.
Do not download private media unless the user confirms access is authorized.
```

### Monitors

Use for ongoing watch tasks outside a single browser session.

```text
Use TweetClaw to create a monitor for @example mentions of "locoagent".
Send events to the configured webhook.
Do not post, reply, follow, or DM.
```

## LocoAgent Handoff Checklist

Before using `/x-com` on TweetClaw output:

1. Confirm the tweet URL still opens in the browser.
2. Read the visible thread context.
3. Check the operation log before repeat likes, replies, follows, or posts.
4. Draft write actions first and ask for approval before submitting.
5. Record the final action with `scripts/log-operation.ts` when the action succeeds.

## When Not to Use TweetClaw

- The task only needs a visible browser interaction already covered by `/x-com`.
- The user has no OpenClaw runtime and no need for structured X/Twitter data.
- The user asks for credential handling in chat.
- The requested action would spam, evade platform limits, or bypass user review.
