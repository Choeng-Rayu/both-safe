# Skill: Orchestrate Sub-Agents via `opencode run`

> **Who reads this skill:** The orchestrator AI (you)  
> **What is the sub-agent:** `opencode run` — a CLI AI agent you invoke via `run_command`  
> **Default model:** `nvidia/openai/gpt-oss-120b` (a smaller model — tasks MUST be atomic)  
> **Source:** Verified against official docs at https://opencode.ai/docs/cli/

---

## Architecture

```
YOU (Orchestrator — large model, the brain)
 │
 │  You plan, decompose, decide session strategy, and synthesize results.
 │  You use run_command to invoke opencode.
 │  You do NOT code directly — you delegate to opencode.
 │  You MUST break big tasks into tiny, atomic steps for the small model.
 │
 ├─ run_command("opencode run ... 'MICRO-TASK 1'")  → opencode sub-agent
 │   └─ opencode does ONE specific thing, returns result
 │      opencode does NOT spawn further sub-agents
 │
 ├─ run_command("opencode run ... 'MICRO-TASK 2'")  → opencode sub-agent
 │   └─ same — executes ONE specific thing, returns result
 │
 └─ You collect outputs, evaluate, synthesize, re-dispatch if needed
```

**Critical rule:** The sub-agent is a SMALLER model (120B). It executes best when given ONE clear, specific, unambiguous task. YOU are the brain — you do the thinking, planning, and decomposition. The sub-agent just executes your precise instructions.

---

## ⚠️ Golden Rules for Small-Model Task Design

**The sub-agent (gpt-oss-120b) is a 120B parameter model. It is NOT a frontier model.**
**It will fail or produce garbage if you give it vague, multi-part, or open-ended tasks.**

### The 5 Rules

```
RULE 1: ONE FILE per task (never ask it to cross-reference multiple files)
RULE 2: ONE ACTION per task (read OR write OR find — never combine)
RULE 3: EXPLICIT output format (show the exact format you want)
RULE 4: NO AMBIGUITY (say exactly what to look for, not "review" or "audit")
RULE 5: GIVE EXAMPLES when possible (show what a correct answer looks like)
```

### ❌ BAD Prompt (too broad, multi-part, ambiguous)

```
"Review src/payments/bakong.provider.ts for bugs, check interface
 compliance against payment-provider.interface.ts, and suggest fixes."
```

Why it fails:
- 3 different actions in one prompt (review + check + suggest)
- 2 files to cross-reference (small model loses context)
- "review for bugs" is vague — what kind of bugs?
- "suggest fixes" is open-ended — how detailed? what format?

### ✅ GOOD Prompt (atomic, specific, formatted)

```
"Read the file src/payments/bakong.provider.ts.
 Find every fetch() call in the file.
 For each fetch() call, answer these 3 questions:
   1. What method name contains this fetch() call?
   2. What line number is the fetch() on?
   3. Is the fetch() wrapped in a try/catch block? (yes or no)
 Output as a markdown table with columns: Method | Line | Has Try/Catch"
```

Why it works:
- ONE file
- ONE action (find fetch calls)
- 3 SPECIFIC questions (not "review")
- EXACT output format (markdown table with named columns)

---

## Task Sizing Guide — How to Decompose

When you receive a big task from the user, decompose it into micro-tasks using this sizing guide:

### Size Categories

```
NANO TASK (best for small model — prefer this size):
  - "Count how many methods are in class X in file Y"
  - "List all import statements in file Y"
  - "Does function X exist in file Y? Return yes/no and the line number"
  - "Read file Y lines 50-100 and return only the function signature on line 67"

MICRO TASK (good for small model):
  - "Find all fetch() calls in file Y, list method name and line number"
  - "Add a try/catch block around the fetch() call on line 150 of file Y"
  - "Create a new file at path X with this exact content: [paste content]"
  - "Replace line 42 of file Y from [old code] to [new code]"

SMALL TASK (acceptable, but at the limit):
  - "Read file Y. Find all config.get() calls. For each one, check if
     there is a fallback default value. Output as a table."
  - "Write a unit test for the function createOrder() in file Y.
     The test should verify that it throws when amount is negative.
     Use Jest. Put the test in file Z."

TOO BIG (will fail — must be decomposed):
  - "Audit the entire payments module for security issues"
  - "Refactor the provider to match the new interface"
  - "Review this file and fix all the bugs"
  - "Build a complete checkout page with Stripe integration"
```

### Decomposition Pattern

When you get a big task, follow this pattern:

```
User says: "Fix all error handling in bakong.provider.ts"

YOU decompose into:

Step 1 (FIND):    "List all async functions in file X. Output: function name, line number"
Step 2 (ANALYZE): "For function [name] at line [N] in file X,
                   does it have a try/catch? Answer: yes or no"
                  (repeat for each function from Step 1)
Step 3 (FIX):     "In file X, wrap the fetch() call on line [N] inside function [name]
                   with a try/catch block. In the catch block, log the error with
                   this.logger.error('Failed to [action]:', error.message)
                   and throw a new Error('[action] failed').
                   Show me only the changed code."
                  (one dispatch per function that needs fixing)
Step 4 (VERIFY):  "Read file X lines [N-5] to [N+10]. Confirm the try/catch
                   is syntactically correct. Output: PASS or FAIL with reason."
```

---

## Step 1 — Discover Available Models

Before dispatching, confirm the model ID exists.

```
run_command:
  Cwd: /home/rayu/both-safe
  Command: opencode models nvidia 2>&1
```

Expected output includes: `nvidia/openai/gpt-oss-120b`

---

## Step 2 — Dispatch a Task

### Template (copy this pattern exactly)

```
run_command:
  Cwd: <PROJECT ROOT WHERE FILES LIVE>     ← this sets opencode's working directory
  SafeToAutoRun: true
  WaitMsBeforeAsync: 5000                   ← background immediately
  Command:
    opencode run \
      --model nvidia/openai/gpt-oss-120b \
      --dangerously-skip-permissions \
      --format json \
      "AGENT-N STEP-M: <one-line action description>

       FILE: <single relative path from Cwd>
       ACTION: <exactly one verb: READ | FIND | COUNT | ADD | REPLACE | CREATE | DELETE>

       INSTRUCTIONS:
       1. <specific step 1>
       2. <specific step 2>
       3. <specific step 3>

       OUTPUT FORMAT:
       <show exact format — table, list, code block, yes/no, or number>" \
      2>&1
```

### Prompt Structure for Small Models

Always structure your prompts with these labeled sections:

```
AGENT-N STEP-M: <title>          ← identity + sequence number

FILE: <one file path>            ← never more than one file

ACTION: <one verb>               ← READ, FIND, COUNT, ADD, REPLACE, CREATE, DELETE

INSTRUCTIONS:                    ← numbered steps, max 3-5
1. ...
2. ...
3. ...

OUTPUT FORMAT:                   ← exact format specification
- Markdown table with columns: X | Y | Z
- OR: bullet list with format "- [name]: [value]"
- OR: code block with only the changed lines
- OR: single word YES or NO
- OR: single number
```

---

## Step 2b — Task Templates (Copy-Paste Ready)

### Template A: FIND something in a file

```
"AGENT-1 STEP-1: Find all fetch calls

 FILE: src/payments/providers/bakong.provider.ts
 ACTION: FIND

 INSTRUCTIONS:
 1. Read the file
 2. Find every line that contains a fetch() call
 3. For each match, record: the method name it is inside, the line number

 OUTPUT FORMAT:
 Markdown table with columns: Method Name | Line Number | Code Snippet"
```

### Template B: CHECK a specific condition

```
"AGENT-1 STEP-2: Check try-catch on specific method

 FILE: src/payments/providers/bakong.provider.ts
 ACTION: READ

 INSTRUCTIONS:
 1. Go to the method named queryOrder()
 2. Check if the fetch() call inside it is wrapped in a try/catch block
 3. If NO try/catch exists, show me lines [start] to [end] of the method

 OUTPUT FORMAT:
 Answer: YES or NO
 If NO, show the method code as a code block"
```

### Template C: WRITE a specific code change

```
"AGENT-1 STEP-3: Add try-catch to queryOrder

 FILE: src/payments/providers/bakong.provider.ts
 ACTION: REPLACE

 INSTRUCTIONS:
 1. Find the queryOrder() method
 2. Find the fetch() call inside it (around line 280)
 3. Wrap ONLY the fetch() call and its response handling in a try/catch
 4. In the catch block, add: this.logger.error('Bakong API query failed', error.message)
 5. Then re-throw with: throw new Error('Failed to query Bakong order status')

 OUTPUT FORMAT:
 Show only the modified queryOrder() method as a TypeScript code block.
 Do NOT show the rest of the file."
```

### Template D: CREATE a new file with exact content

```
"AGENT-2 STEP-1: Create unit test file

 FILE: src/payments/providers/__tests__/bakong.provider.spec.ts
 ACTION: CREATE

 INSTRUCTIONS:
 1. Create a new Jest test file at the path above
 2. Import BakongProvider from '../bakong.provider'
 3. Write exactly 1 test: 'should throw when amount is negative'
 4. The test should call createOrder({ amount: -100, currency: 'USD' })
 5. Assert that it throws an error with message containing 'invalid amount'

 OUTPUT FORMAT:
 The complete file content as a TypeScript code block."
```

### Template E: COUNT / MEASURE something

```
"AGENT-3 STEP-1: Count public methods

 FILE: src/payments/providers/bakong.provider.ts
 ACTION: COUNT

 INSTRUCTIONS:
 1. Read the file
 2. Count how many public methods (not private, not protected) are in the BakongProvider class
 3. List each one by name

 OUTPUT FORMAT:
 Total: [number]
 Methods:
 - methodName1 (line N)
 - methodName2 (line N)"
```

### Template F: VERIFY a previous change

```
"AGENT-1 STEP-4: Verify syntax correctness

 FILE: src/payments/providers/bakong.provider.ts
 ACTION: READ

 INSTRUCTIONS:
 1. Read lines 275 to 310 of the file
 2. Check if the code is syntactically valid TypeScript
 3. Check that all braces {} are balanced
 4. Check that the try/catch block has both a try and a catch clause

 OUTPUT FORMAT:
 RESULT: PASS or FAIL
 If FAIL, explain exactly what is wrong on which line."
```

---

## Step 3 — Collect Results

After dispatching (the command goes to background), use `command_status` to collect:

```
command_status:
  CommandId: <background-command-id>
  WaitDurationSeconds: 120
  OutputCharacterCount: 6000
```

Read the result. Check for `Exit code: 0` = success.

### Interpreting Small-Model Output

The small model may:
- ✅ Return a clean table/list → use it directly
- ⚠️ Add extra commentary around the answer → extract just the data
- ⚠️ Get a line number off by 1-2 → verify with a follow-up NANO task
- ❌ Return confused/rambling text → re-dispatch with a simpler prompt
- ❌ Hallucinate file content → always verify critical findings before acting

**When in doubt, verify before applying changes.** Send a follow-up NANO task:
```
"Read file X lines [N-2] to [N+2]. Show me exactly what is on those lines.
 Output as a code block with line numbers."
```

---

## Step 4 — Session Decision: Reuse or New?

### Capturing the Session ID

From the JSON output, extract `sessionID` for potential follow-ups:

```
In the command output, look for:
  "sessionID":"ses_XXXXXXXXX"

Extract it with:
  grep -o '"sessionID":"[^"]*"' | head -1 | cut -d'"' -f4
```

### Decision Logic

```
Is the next task DIRECTLY RELATED to what this agent just did?
│
├─ YES → REUSE session: add --session <captured-session-id>
│   Use when:
│   - STEP-2 follows STEP-1 on the same file
│   - Fixing something the agent just found
│   - Verifying a change the agent just made
│   - Agent needs context from its previous answer
│
│   Benefits for small model:
│   - It already read the file (no re-reading needed)
│   - It remembers what it found (no re-explaining)
│   - Shorter prompt = less confusion
│
│   You MUST still pass --dangerously-skip-permissions again
│   You can use a shorter prompt (e.g. "Now fix the issue you found on line 150")
│
└─ NO → NEW session: do NOT pass --session
    Use when:
    - Different file entirely
    - Different concern (e.g. switching from error handling to testing)
    - Parallel dispatch to another agent
    - The prior session had errors/confusion (fresh start is cleaner)
```

### Reuse Example (follow-up to a FIND task)

```
run_command:
  Cwd: /home/rayu/both-safe/bothsafe
  Command:
    opencode run \
      --model nvidia/openai/gpt-oss-120b \
      --dangerously-skip-permissions \
      --session ses_209f4a609ffeBhgvrgy8lieKgH \
      "AGENT-1 STEP-2: Fix the issue you found

       You found that queryOrder() has a fetch() without try/catch.
       Now wrap that fetch() call in a try/catch block.
       In the catch: this.logger.error('Bakong query failed:', error.message)
       Then re-throw: throw new Error('Failed to query order status')

       OUTPUT FORMAT:
       Show only the changed method as a code block." \
      2>&1
```

Notice:
- `--session ses_...` → reuses the prior session (agent remembers the file + findings)
- `--dangerously-skip-permissions` → MUST be passed again (not stored in session)
- Prompt is short because the agent already has context
- Still uses INSTRUCTIONS + OUTPUT FORMAT structure

### New Session Example (unrelated task)

```
run_command:
  Cwd: /home/rayu/both-safe/bothsafe
  Command:
    opencode run \
      --model nvidia/openai/gpt-oss-120b \
      --dangerously-skip-permissions \
      --format json \
      "AGENT-2 STEP-1: List all exported types

       FILE: src/payments/payment-provider.interface.ts
       ACTION: FIND

       INSTRUCTIONS:
       1. Read the file
       2. Find every exported type, interface, or enum
       3. For each, record: the name, the kind (type/interface/enum), line number

       OUTPUT FORMAT:
       Markdown table: Name | Kind | Line Number" \
      2>&1
```

---

## Step 5 — Permission Rules

`--dangerously-skip-permissions` is a **per-process flag**. It:
- ✅ Allows the current `opencode run` process to auto-approve all tool use
- ❌ Does NOT persist into the session
- ❌ Does NOT affect the user's own opencode TUI
- ❌ Does NOT affect any other `opencode run` process

**You MUST pass it on EVERY invocation** — including session reuse:

```
# ✅ Correct: flag on every call
opencode run --dangerously-skip-permissions --session $SES "fix it..."

# ❌ Wrong: reuse without flag → agent pauses and waits for manual approval
opencode run --session $SES "fix it..."
```

---

## Step 6 — Parallel Dispatch (Multiple Sub-Agents)

You can dispatch multiple independent tasks in parallel. Rules:

- ✅ Multiple agents READING the same file → safe, always parallel
- ✅ Multiple agents WRITING to DIFFERENT files → safe, parallel
- ❌ Multiple agents WRITING to the SAME file → NOT safe, must be sequential
- ❌ Follow-up that depends on prior result → must be sequential

### Pattern: Decompose then Parallel-Dispatch

```
User says: "Improve error handling across the payments module"

YOU think: This has 3 files. I'll dispatch 3 agents in parallel,
           each doing a FIND task on one file.

AGENT-1 STEP-1: "Find all unhandled async calls in FILE: src/payments/payment.service.ts"
AGENT-2 STEP-1: "Find all unhandled async calls in FILE: src/payments/providers/bakong.provider.ts"
AGENT-3 STEP-1: "Find all unhandled async calls in FILE: src/payments/providers/stripe.provider.ts"

(All 3 are READ-ONLY on different files → safe to run in parallel)

After collecting results:

AGENT-1 STEP-2: "Fix the fetch on line 45 of payment.service.ts" (--session 1)
AGENT-2 STEP-2: "Fix the fetch on line 280 of bakong.provider.ts" (--session 2)
AGENT-3 STEP-2: "Fix the fetch on line 112 of stripe.provider.ts" (--session 3)

(All 3 are WRITING to different files → safe to run in parallel)
```

---

## Step 7 — Working Directory Rules

**The `Cwd` parameter in your `run_command` call sets opencode's working directory.**

opencode sees files relative to this path. Set it to the root of the subproject:

```
Cwd: /home/rayu/both-safe/bothsafe     → agent can access src/payments/...
Cwd: /home/rayu/both-safe              → agent sees bothsafe/src/payments/...
```

If the project is a monorepo, point to the specific package root.

**Recommended: use `Cwd` only.** Do not also use `--dir`.

---

## Step 8 — Using Design Skills for UI Tasks

opencode has a pre-installed skill: `awesome-design-md` with 60+ brand design systems.

Location: `/home/rayu/.config/opencode/skills/awesome-design-md/design-md/`

Available brands include: `stripe`, `vercel`, `linear.app`, `supabase`, `notion`, `airbnb`, `spotify`, `tesla`, `ferrari`, `figma`, `cursor`, and many more.

**When dispatching a UI/frontend task**, break it down and include the design file:

```
Step 1 — Read the design system (NANO task):
"AGENT-4 STEP-1: Read design system
 FILE: /home/rayu/.config/opencode/skills/awesome-design-md/design-md/stripe/DESIGN.md
 ACTION: READ
 INSTRUCTIONS:
 1. Read the design system file
 2. Extract: primary colors, font family, border radius, spacing scale
 OUTPUT FORMAT:
 Bullet list of each design token and its value"

Step 2 — Create the component (reuse session):
"AGENT-4 STEP-2: Create checkout button component
 FILE: src/components/CheckoutButton.tsx
 ACTION: CREATE
 INSTRUCTIONS:
 1. Create a React button component
 2. Use the Stripe design tokens from the design system you just read
 3. Primary color for background, white text, 8px border radius
 4. Add hover state: darken background by 10%
 5. Props: label (string), onClick (function), disabled (boolean)
 OUTPUT FORMAT:
 Complete file as a TypeScript React code block"
```

**Orchestrator rule:** When a task involves UI work, always check:
```
ls /home/rayu/.config/opencode/skills/awesome-design-md/design-md/
```
to find matching brand styles.

---

## Step 9 — Cost & Session Management

```bash
# List recent sessions
opencode session list -n 10

# Find a lost session ID (JSON for scripting)
opencode session list --format json

# Export a session transcript
opencode export <session-id>
opencode export <session-id> --sanitize    # removes secrets

# Check token usage and cost
opencode stats
opencode stats --days 7
opencode stats --models

# Clean up old sessions
opencode session delete <session-id>
```

---

## Step 10 — Handling Small-Model Failures

The small model WILL sometimes fail. Here's how to handle each failure mode:

### Failure: Model returns confused/rambling output
```
FIX: Simplify the prompt. Break it into an even smaller task.
     Remove any optional context. Keep only: FILE + ACTION + 1-3 INSTRUCTIONS + OUTPUT FORMAT.
```

### Failure: Model hallucinates file content or line numbers
```
FIX: Never trust line numbers from the small model for WRITE operations.
     Always verify with a NANO read task first:
     "Read file X lines [N-3] to [N+3]. Show exact content as a code block with line numbers."
     Then dispatch the WRITE task with the verified line numbers.
```

### Failure: Model makes partial changes (incomplete edit)
```
FIX: Use session reuse and say exactly what is missing:
     "You made a change but missed the closing brace on line 155.
      Add a closing brace } on a new line after line 155.
      Show me lines 150-160 after the fix."
```

### Failure: Model doesn't follow output format
```
FIX: Re-dispatch with an even more explicit format. Include a FILLED EXAMPLE:
     "OUTPUT FORMAT:
      Markdown table. Example:
      | Method | Line | Has Try/Catch |
      |--------|------|---------------|
      | createOrder | 42 | yes |
      | queryOrder | 150 | no |

      Fill this table with the real data from the file."
```

### Failure: Model says "I can't do that" or refuses
```
FIX: The model may be confused about permissions.
     Make sure --dangerously-skip-permissions is passed.
     Rephrase the task to be more direct: "Do X" instead of "Could you X?"
```

---

## Orchestrator Checklist (run through this before every dispatch)

```
Before dispatching:
 □ Task is ATOMIC — one file, one action, one concern
 □ Prompt has labeled sections: FILE, ACTION, INSTRUCTIONS, OUTPUT FORMAT
 □ Instructions are numbered, max 3-5 steps
 □ Output format is explicit (table/list/code block/yes-no/number)
 □ Cwd is set to the correct project root
 □ --dangerously-skip-permissions is included
 □ --format json is included (if I need the session ID later)
 □ Prompt does NOT ask opencode to delegate to sub-agents
 □ If follow-up: --session <id> is included
 □ If new concern: no --session (fresh start)
 □ If UI task: design system file path is included in prompt
 □ No two agents are writing the same file at the same time

After collecting result:
 □ Check exit code = 0
 □ Verify the output matches expected format
 □ If output has line numbers, verify them before using in WRITE tasks
 □ Extract session ID if I might follow up
 □ Decide: reuse session or new session for next task
 □ If multiple agents wrote files, verify no conflicts
```

---

## Anti-Patterns (Do NOT do these)

```
❌ Give multi-part tasks: "Find bugs AND fix them AND write tests"
   → Break into 3 separate dispatches: FIND → FIX → TEST

❌ Use vague verbs: "review", "audit", "improve", "refactor"
   → Use specific verbs: FIND, COUNT, LIST, ADD, REPLACE, CREATE, DELETE, CHECK

❌ Ask to cross-reference multiple files in one task
   → Read each file in a separate task, then YOU synthesize

❌ Skip output format specification
   → Small model will return unpredictable format; always specify

❌ Trust line numbers from small model without verification
   → Always verify with a READ task before dispatching a WRITE task

❌ Tell opencode to "delegate to a sub-agent" or "spawn another agent"
   → opencode is YOUR sub-agent. It executes directly.

❌ Omit --dangerously-skip-permissions on session reuse
   → Agent will pause and wait for manual approval (hangs forever)

❌ Run opencode from wrong Cwd
   → Agent won't find the files referenced in the prompt

❌ Reuse --session for an unrelated task
   → Context pollution — agent carries stale findings from prior work

❌ Use --continue when managing multiple parallel agents
   → --continue picks the MOST RECENT session, which may be wrong

❌ Dispatch two agents writing the same file in parallel
   → Race condition — one agent's writes get overwritten
```

---

## Complete Decision Flowchart

```
You receive a task from the user
│
├─ Is it a NANO/MICRO task already? (single file, single action)
│   YES → Dispatch directly as one opencode run
│   NO  → Decompose using the sizing guide ↓
│
├─ Decompose into steps:
│   Step 1: FIND/READ tasks (gather information)
│   Step 2: ANALYZE results yourself (you are the brain)
│   Step 3: WRITE/FIX tasks (apply changes, one per file)
│   Step 4: VERIFY tasks (confirm changes are correct)
│
├─ For each step, for each sub-task:
│   ├─ Write prompt with: FILE + ACTION + INSTRUCTIONS + OUTPUT FORMAT
│   ├─ Set Cwd to correct project root
│   ├─ Include --dangerously-skip-permissions
│   ├─ Include --format json (if session reuse might be needed)
│   ├─ Can it run parallel with other tasks in this step?
│   │   ├─ Same step, different files → YES, parallel
│   │   ├─ Same step, same file, both READ → YES, parallel
│   │   ├─ Same step, same file, any WRITE → NO, sequential
│   │   └─ Different step (depends on prior) → NO, sequential
│   └─ Dispatch via run_command (background: WaitMsBeforeAsync=5000)
│
├─ Collect results via command_status (WaitDurationSeconds=120)
│
├─ For each result, decide:
│   ├─ GOOD result      → use it, move to next step
│   ├─ Partial result   → re-dispatch with --session, clarify what's missing
│   ├─ Bad format       → re-dispatch with --session, add output example
│   ├─ Wrong content    → new session, simpler prompt
│   └─ FAILED (exit≠0)  → retry with --session and refined prompt
│
└─ Synthesize all results → report to user
```
