# Skill: Orchestrate Sub-Agents via `opencode run`

> **Your Role:** You = Orchestrator (brain). `opencode run` = Sub-agent (hands).  
> **Sub-agent model:** `nvidia/openai/gpt-oss-120b` — small, fast, needs atomic tasks.  
> **Token goal:** Think once, dispatch precisely, collect cleanly.

---

## Mental Model (read once, internalize)

```
YOU → decompose → dispatch → collect → synthesize → user
         ↑                       ↓
         └──── re-dispatch if needed ────┘
```

**You plan. Sub-agent executes ONE thing per call. Never delegate thinking.**

---

## Before You Dispatch — "Buy-In" Check

> Ask yourself these 3 questions before writing the prompt.  
> If any answer is NO, redesign the task first.

| # | Question | Required Answer |
|---|----------|----------------|
| 1 | Can I state the task in ONE sentence? | YES |
| 2 | Is there exactly ONE file and ONE action? | YES |
| 3 | Can I describe what "done" looks like in ≤ 2 lines? | YES |

---

## Task Sizing (pick the smallest that works)

| Size | Rule | Example |
|------|------|---------|
| **NANO** | 1 fact from 1 file | "Does function X exist? Return YES/NO + line #" |
| **MICRO** | 1 find or 1 write | "Find all fetch() calls → table: method, line" |
| **SMALL** | 1 read + 1 decision | "Read Y, check all async fns have try/catch → table" |
| **❌ TOO BIG** | Any "and" or "then" | "Review + fix + test" → split into 3 tasks |

---

## Dispatch Template

```bash
opencode run \
  --model nvidia/openai/gpt-oss-120b \
  --dangerously-skip-permissions \
  --format json \
  "TASK: <one verb + one outcome>

   FILE: <single relative path>
   ACTION: READ | FIND | COUNT | ADD | REPLACE | CREATE | DELETE

   STEPS:
   1. <exact step>
   2. <exact step>
   [max 3 steps]

   DONE WHEN:
   <what the output must contain — be specific>

   OUTPUT:
   <exact format: table columns / YES or NO / code block / number>" \
  2>&1
```

**Required flags every single call:**
- `--dangerously-skip-permissions` — skip this = agent hangs forever
- `--format json` — needed to extract session ID for follow-ups
- `Cwd:` = project root where files live

---

## Task Assignment Patterns

### FIND
```
TASK: Find all fetch() calls in bakong.provider.ts
FILE: src/payments/bakong.provider.ts
ACTION: FIND
STEPS:
1. Read the file
2. Find every fetch() call
DONE WHEN: Table has Method, Line, Has-Try-Catch columns filled
OUTPUT: Markdown table | Method | Line | Has Try/Catch |
```

### WRITE (always verify line # first with a NANO read)
```
TASK: Wrap fetch() on line 150 in try/catch
FILE: src/payments/bakong.provider.ts
ACTION: REPLACE
STEPS:
1. Go to line 150 (the fetch() inside queryOrder())
2. Wrap it in try/catch
3. catch: this.logger.error('query failed:', error.message); throw new Error('query failed')
DONE WHEN: Modified method shown, braces balanced
OUTPUT: Only the changed method as a TypeScript code block
```

### VERIFY
```
TASK: Confirm try/catch syntax is valid on lines 148–165
FILE: src/payments/bakong.provider.ts
ACTION: READ
STEPS:
1. Read lines 148–165
2. Check braces are balanced, try and catch both present
DONE WHEN: PASS or FAIL stated with reason
OUTPUT: RESULT: PASS / FAIL — [reason if FAIL]
```

---

## "Done" Signal — What to Check After Collection

```
✅ Exit code: 0          → success
✅ Output matches format  → use it directly
⚠️ Extra commentary       → extract the data, ignore the prose
⚠️ Line # feels off       → dispatch NANO verify before any WRITE
❌ Confused/rambling      → re-dispatch, cut prompt in half
❌ Exit code ≠ 0          → retry with --session + simpler prompt
```

**Never apply a WRITE based on unverified line numbers. Always NANO-verify first.**

---

## Session Reuse Decision

```
Same file + same concern + continuing from last step?  → --session <id>
Different file OR different concern?                   → no --session (fresh start)
Prior session had errors/confusion?                    → no --session (fresh start)
```

Extract session ID from JSON output:
```bash
grep -o '"sessionID":"[^"]*"' output.txt | cut -d'"' -f4
```

Reuse call (shorter prompt is OK — agent has context):
```bash
opencode run \
  --model nvidia/openai/gpt-oss-120b \
  --dangerously-skip-permissions \
  --session <ses_id> \
  "Fix the issue you found on line 150. Same output format as before." \
  2>&1
```

---

## Parallel Dispatch Rules

| Scenario | Safe? |
|----------|-------|
| Multiple agents READ same file | ✅ Yes |
| Multiple agents WRITE different files | ✅ Yes |
| Multiple agents WRITE same file | ❌ No — sequential only |
| Step B depends on Step A result | ❌ No — sequential only |

---

## Failure Recovery (quick reference)

| Symptom | Fix |
|---------|-----|
| Rambling output | Simplify: remove all optional context, keep FILE + ACTION + 1–2 STEPS + OUTPUT |
| Wrong line numbers | NANO verify: "Read lines N-3 to N+3, show as code block with line numbers" |
| Incomplete edit | --session reuse: "You missed the closing brace after line 155. Add it." |
| Wrong output format | --session reuse: add a filled example row to OUTPUT section |
| Agent refuses | Check --dangerously-skip-permissions is present; rephrase as imperative ("Do X") |

---

## Orchestrator Dispatch Checklist

```
□ Task passes Buy-In Check (1 sentence, 1 file, 1 action, clear "done")
□ Prompt has: TASK / FILE / ACTION / STEPS (≤3) / DONE WHEN / OUTPUT
□ Cwd = correct project root
□ --dangerously-skip-permissions present
□ --format json present (if session reuse possible)
□ WRITE task? → NANO verify line numbers first
□ Parallel dispatch? → no two agents writing the same file
□ Follow-up? → include --session <id>
□ Unrelated next task? → no --session
```

---

## Anti-Patterns (memorize these)

```
❌ "Find AND fix AND test"         → 3 dispatches: FIND → FIX → TEST
❌ "Review / audit / improve"      → replace with: FIND / REPLACE / CREATE
❌ 2 files in one prompt           → read each separately, YOU synthesize
❌ Skip --dangerously-skip-permissions on reuse  → agent hangs
❌ Trust line numbers without verify  → NANO read first
❌ Ask sub-agent to spawn agents    → you are the only orchestrator
❌ Reuse session for unrelated task → context pollution
```

---

## UI Tasks — Design System Shortcut

Pre-installed brand design systems at:
```
/home/rayu/.config/opencode/skills/awesome-design-md/design-md/<brand>/DESIGN.md
```

Step 1 (NANO): Read `<brand>/DESIGN.md` → extract colors, fonts, border-radius  
Step 2 (MICRO, reuse session): Create component using those tokens

Available brands: `stripe` `vercel` `linear.app` `supabase` `notion` `figma` `cursor` `airbnb` `spotify` (and 50+ more — `ls` the directory)