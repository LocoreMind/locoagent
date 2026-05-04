# Social Agent Task Schedule

> This file defines the recurring tasks the agent executes each session.
> Edit freely to adjust targets, frequency, or content strategy.
> The agent reads this at startup alongside the operation log to decide what to do.

---

## Daily Tasks

### 1. Engage with Local LLM / Agent Training Content
- **Platform:** x
- **Action:** Search and like 5 relevant posts
- **Queries:** `local LLM agent`, `agent post-training`, `LocoTrainer`, `llama.cpp agent`
- **Filter:** Posts from the last 24 hours, technically substantive (not pure hype)
- **Skip:** Any URL already in the operation log

### 2. Monitor Own Project Mentions
- **Platform:** x
- **Action:** Search for mentions of LocoOperator, LocoTrainer, LocoreMind — reply to any genuine questions or comments
- **Queries:** `LocoOperator`, `LocoTrainer`, `LocoreMind`
- **Log action:** `mention-reply`

### 3. Leave 1 Technical Comment
- **Platform:** x
- **Action:** Pick the single most relevant post from task 1 and leave a genuine technical reply
- **Constraint:** Only 1 comment per session — quality over quantity
- **Voice:** Direct, data-backed, reference real experiment results when relevant
- **Log action:** `comment`

---

## Weekly Tasks (run on Monday sessions)

### 4. Follow Relevant Researchers
- **Platform:** x
- **Action:** Find 3-5 researchers actively working on local LLM inference or agent post-training, follow them
- **Source:** People who engaged with posts found in task 1 this week
- **Constraint:** Do not follow accounts already followed (check log)
- **Log action:** `follow`

### 5. Post Original Content
- **Platform:** x
- **Action:** Draft and post 1 original tweet about a recent finding, model release, or research insight
- **Topics:** LocoTrainer/LocoOperator updates, benchmark results, observations from agent post-training experiments
- **Format:** Lead with a concrete result or number, max 3 bullet points, link to artifact if relevant
- **Log action:** `post`

---

## Session Constraints

| Constraint | Limit |
|------------|-------|
| Max likes per session | 10 |
| Max comments per session | 2 |
| Max follows per session | 5 |
| Max original posts per session | 1 |
| Min time between comments on same thread | never (only 1 comment per thread) |

---

## Platforms Active

| Platform | Status | Notes |
|----------|--------|-------|
| x | active | Primary platform |
| reddit | active | Secondary — r/LocalLLaMA, r/MachineLearning, r/artificial |

---

## Notes for the Agent

1. **Always check the operation log first** — run `bun run scripts/log-operation.ts check` before every action
2. **Daily tasks run every session** — weekly tasks only on Mondays (check `new Date().getDay() === 1`)
3. **Session order:** monitor mentions → engage content → comment → (weekly: follow + post)
4. **If a platform is unreachable or login expired** — log status `restricted` and continue with other tasks
5. **Never exceed session constraints** — stop the task category once the limit is hit, even if more targets exist
