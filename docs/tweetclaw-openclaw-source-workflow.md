# TweetClaw OpenClaw Source Workflow

TweetClaw is an optional OpenClaw plugin that can supply structured X/Twitter data before LocoAgent acts through a real browser session.
Use it when a workflow needs tweet search, reply search, follower export, user lookup, media checks, monitors, webhooks, direct messages, or reviewed post and reply actions.

LocoAgent remains the browser operator.
TweetClaw is the source-data layer.

## Install

```bash
openclaw plugins install @xquik/tweetclaw
```

Configure one credential path:

```bash
openclaw config set plugins.entries.tweetclaw.config.apiKey "$XQUIK_API_KEY"
openclaw config set tools.alsoAllow '["explore", "tweetclaw"]'
openclaw plugins inspect tweetclaw --runtime
openclaw skills info tweetclaw
```

For read-only MPP usage:

```bash
openclaw config set plugins.entries.tweetclaw.config.tempoSigningKey "$MPP_SIGNING_KEY"
```

Keep API keys, signing keys, cookies, and session material out of prompts, logs, screenshots, and committed files.

## Recommended Flow

1. Ask OpenClaw with TweetClaw to produce a source brief.
2. Review the returned tweet URLs, handles, summaries, and suggested actions.
3. Use LocoAgent with `/x-com` to open the selected URLs in the browser.
4. Read the visible thread context before any engagement.
5. Draft write actions and wait for approval before clicking submit.
6. Record completed browser actions in LocoAgent's operation log.

## Source Brief Prompt

```text
Use TweetClaw to search tweets about "open source AI agents".
Return JSON with tweetUrl, author, postedAt, summary, metrics, and suggestedAction.
Limit to 10 items.
Exclude duplicates, giveaways, and low-context reposts.
Do not post, reply, like, follow, delete, or send direct messages.
```

Example output shape:

```json
{
  "query": "open source AI agents",
  "items": [
    {
      "tweetUrl": "https://x.com/example/status/123",
      "author": "example",
      "postedAt": "2026-05-23T12:00:00Z",
      "summary": "Short factual summary",
      "metrics": {
        "likes": 42,
        "replies": 8
      },
      "suggestedAction": "read"
    }
  ]
}
```

## Browser Handoff Prompt

After selecting one or more target URLs, hand them to LocoAgent:

```text
/x-com open https://x.com/example/status/123, read the visible thread, and draft one short reply. Do not submit until I approve it.
```

For repeat workflows, check the operation log before acting:

```bash
bun run scripts/log-operation.ts check --platform x --action reply --url "https://x.com/example/status/123"
```

Record successful actions:

```bash
bun run scripts/log-operation.ts add --platform x --action reply --url "https://x.com/example/status/123" --status success --note "Replied after TweetClaw source brief"
```

## Use Cases

### Search Tweets

Use TweetClaw to gather candidate posts for LocoAgent to inspect in Chrome:

```text
Use TweetClaw to search tweets for "AI agent monitoring".
Return the 10 best candidates with tweet URL, author, text summary, and engagement signals.
Prefer recent technical posts.
Do not write anything.
```

### Search Replies

Use reply search to turn a single thread into an engagement or support brief:

```text
Use TweetClaw to search replies for this tweet URL: <tweet-url>.
Group replies by question, objection, bug report, praise, and noise.
Return representative reply URLs and one concise summary per group.
```

### Follower Export

Use follower export to create a reviewed shortlist before LocoAgent opens profiles:

```text
Use TweetClaw to export followers for @example.
Return a shortlist with handle, profile summary, and reason for follow-up.
Do not follow or message anyone.
```

### Monitors

Use monitors for ongoing alerts outside a single browser session:

```text
Use TweetClaw to monitor @example for mentions of "locoagent".
Send events to the configured webhook.
Do not post, reply, follow, or DM.
```

## Safety Checklist

- Use TweetClaw for source data before browser actions.
- Use `/x-com` for browser verification and visible thread context.
- Keep write-like operations approval-gated.
- Never paste secrets into prompts.
- Do not automate spam, harassment, credential collection, or platform-limit evasion.

## Links

- [TweetClaw GitHub](https://github.com/Xquik-dev/tweetclaw)
- [TweetClaw npm package](https://www.npmjs.com/package/@xquik/tweetclaw)
- [TweetClaw ClawHub listing](https://clawhub.ai/plugins/@xquik/tweetclaw)
