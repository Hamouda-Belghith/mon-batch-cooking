# Agent teams: master reference

How to design, launch, run and shut down Claude Code agent teams. Sections
1–8 restate the official docs. Sections 9–13 are the playbook: how to
build *effective* teams, with templates and rules for this repository.

- Sources: <https://code.claude.com/docs/en/agent-teams> plus the pages it
  links to (sub-agents, hooks, costs). Last checked: 2026-10-04.
- Agent teams are **experimental**. Behaviour and version thresholds
  change. Re-check the source page before relying on a detail marked with
  a version number.

---

## 1. What an agent team is

One Claude Code session (the **lead**) spawns other full Claude Code
sessions (**teammates**). Each teammate has its own context window. They
coordinate through a **shared task list** and **direct messages**. You can
also talk to any teammate yourself, without going through the lead.

| Component | Role |
| :- | :- |
| Team lead | The main session. Spawns teammates, creates tasks, synthesizes results. Fixed for the session's lifetime. |
| Teammates | Separate Claude Code instances working on assigned or self-claimed tasks. |
| Task list | Shared work items: `pending` → `in progress` → `completed`, with dependencies. |
| Mailbox | Messaging between agents (one JSON inbox file per agent). |

### Teams vs subagents vs other options

| | Subagents | Agent teams |
| :- | :- | :- |
| Context | Own window. The result returns to the caller. | Own window. Fully independent. |
| Communication | Return a result. Named subagents can message each other. | Teammates message each other directly. |
| Coordination | The main agent manages everything. | Self-coordination: messages plus the shared task list. |
| Best for | Focused tasks where only the result matters. | Work that needs discussion, challenge and collaboration. |
| Token cost | Lower: results are summarized back. | Higher: every teammate is a full Claude instance. |

Lighter options to consider first:

- **Subagents**: one session delegates focused work.
- **Cross-session messaging**: sessions you run yourself pass findings to
  each other.
- **Git worktrees**: you run several sessions by hand, with no automated
  coordination.

---

## 2. Enabling

Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the environment or in a
settings `env` block. **This repo already sets it** in
`.claude/settings.local.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Without it, no team is set up, no team directories are written, and Claude
never spawns or proposes teammates.

Side effects to know about:

- **A named subagent becomes a teammate.** While teams are enabled, any
  Agent tool call with a `name` launches a teammate. Claude Code asks for
  no confirmation. Two exceptions: a fork, or a call that passes
  `isolation` itself. Claude names subagents on its own so it can message
  them later, so teams can form even when nobody asked for one.
- **Interactive sessions only.** In `-p` / headless / Agent SDK sessions,
  no teammates are spawned. A named subagent runs as an ordinary subagent.
- **Turning it off:** set the variable to `"0"`. Saving the settings file
  re-applies `env` to the running session, and the variable is re-read at
  each spawn, so no restart is needed. Precedence still applies: a higher
  source that sets `1` wins. Order, lowest to highest: user, project,
  local, `--settings`, managed.

---

## 3. Starting a team

Describe the task and the teammates in plain language:

```text
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Spawn three teammates to explore this from different angles:
one on UX, one on technical architecture, one playing devil's advocate.
```

Claude may use subagents instead of forming a team. Subagents show in the
same agent panel, so the panel alone doesn't prove a team formed. If that
happens, ask again and say **"agent team"** explicitly.

To be explicit about count and model:

```text
Spawn 4 teammates to refactor these modules in parallel. Use Sonnet for each teammate.
```

**Give teammates predictable names.** Tell the lead what to call each one
("call them `ui`, `api`, `reviewer`"). Names are message addresses, and you
will refer to them in later prompts.

---

## 4. Controlling a team

### Display modes (`teammateMode` in `~/.claude/settings.json`, or `claude --teammate-mode <mode>`)

| Value | Behaviour |
| :- | :- |
| `"in-process"` (default) | All teammates run inside the lead's terminal. Works everywhere. |
| `"auto"` | Split panes if you're already inside tmux, or in iTerm2 with the `it2` CLI. Otherwise in-process. |
| `"tmux"` | Split panes. Auto-detects tmux vs iTerm2. |
| `"iterm2"` | iTerm2 native panes. Requires `it2` and *Settings → General → Magic → Enable Python API*. |

Split panes are **not supported** in VS Code's integrated terminal, Windows
Terminal or Ghostty. **This repo is worked on from VS Code on WSL, so use
in-process mode.**

### Keys (in-process agent panel, below the prompt)

| Key | Action |
| :- | :- |
| ↑ / ↓ | Select a teammate |
| Enter | Open its transcript and message it directly |
| Esc | Clear the selection. While viewing a teammate, Esc interrupts its current turn. |
| `x` | Stop the selected teammate |
| Ctrl+T | Toggle the task list |

Panel behaviour:

- Idle rows stay visible while anyone is still working.
- Once everyone is idle, idle rows hide after 30 s. The teammate is still
  running and addressable.
- When more than 3 teammates are idle, the extra rows collapse into
  `N idle agents`. Press Enter to expand.

While you're viewing a teammate:

- Plain text and skills go to **that teammate**.
- Built-in commands go to the **lead**.
- `/compact`, `/clear` and `/rewind` ask for confirmation, because they act
  on the lead.
- `/model` and `/fast` are refused, because a teammate's model and fast
  mode are fixed at spawn.

### How a teammate's model is chosen (first match wins)

1. The model named for that teammate in the spawn prompt.
2. The `model` of its subagent definition (`inherit` means the lead's model).
3. `CLAUDE_CODE_SUBAGENT_MODEL`, if set to anything other than `inherit`.
4. The lead's current model.

With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, steps 1 and 2 are skipped.
`teammateDefaultModel` was removed, so name the model in the prompt
instead. Org `availableModels` allowlists can substitute the model.
Teammates inherit the lead's **effort** level.

### Plan before implementing

1. Put the lead in plan mode first.
2. Ask for the teammate.

Teammates spawned this way work read-only until their plan is ready. The
plan approval request is **auto-approved by the lead session**, without
review. The teammate's edits and commands still go through normal
permission prompts.

### Tasks

- The lead creates tasks. It assigns them, or teammates **self-claim** the
  next unassigned, unblocked task.
- A pending task with unresolved dependencies can't be claimed.
- Completing a task unblocks its dependents automatically.
- Claiming uses file locks, so there are no race conditions.
- Agents without the Task tools coordinate by message only.

### Shutting down

Say "Ask the researcher teammate to shut down." The teammate approves and
exits gracefully, or rejects with a reason. It finishes its current tool
call first, so this can be slow. Team directories are cleaned up when the
session ends.

---

## 5. Architecture and files

| Path | Content | Lifetime |
| :- | :- | :- |
| `~/.claude/teams/{team}/config.json` | Runtime state: a `members` array with name, agent ID and agent type (the lead is `team-lead`). | Removed when the session ends. **Never edit or pre-author it**: it is overwritten. |
| `~/.claude/teams/{team}/inboxes/{agent}.json` | One mailbox per agent. Malformed entries are dropped with an error. | Removed with the team. |
| `~/.claude/tasks/{team}/` | The task list. | Persists for resume. Swept by `cleanupPeriodDays`. |

- The team name is `session-` + the first 8 characters of the session ID.
- **One team per session.** No project-level team config exists: a
  `.claude/teams/*.json` in the repo is just a file. Define reusable
  **roles** as subagent definitions instead (§7).
- A message counts as "sent" only if the mailbox write succeeded.

### Context each teammate gets

Teammates **do** get:

- the same project context as a normal session: CLAUDE.md, MCP servers
  and skills;
- with `--setting-sources`, the same restricted list of sources;
- the lead's **spawn prompt**.

Teammates do **not** get the lead's conversation history.

Communication:

- **Automatic delivery.** Messages arrive without polling.
- **Idle notifications.** When a teammate finishes, it notifies the lead
  and includes its final answer. On an API error, it notifies the lead
  with the error text.
- **No broadcast.** To reach everyone, send one message per teammate.

---

## 6. Permissions and trust

- Teammates start in the lead's permission mode, **except `dontAsk`**,
  which they don't inherit.
- `--dangerously-skip-permissions` on the lead applies to every teammate.
- You can't set per-teammate modes at spawn. You can change a teammate's
  mode afterwards.
- **Teammate permission prompts appear in the lead's session.** Pre-approve
  common commands (tsc, build, test, git status/diff) in permission
  settings before spawning, or the lead is buried in prompts.
- A message from another agent is never your consent. An agent can't
  approve a prompt for you, and can't relay a denied action to another
  teammate to get around a check.
- In auto mode, the classifier reviews every inter-agent message, and
  blocked messages are never delivered.

---

## 7. Reusable roles: subagent definitions

Define a role once in `.claude/agents/<name>.md` (project, checked in) or
`~/.claude/agents/` (personal). Spawn it with: "Spawn a teammate using the
`<name>` agent type to …".

```markdown
---
name: security-reviewer
description: Reviews changes for security issues (authz, RLS, secrets, injection). Use after implementing features that touch auth or data access.
tools: Read, Grep, Glob, Bash
model: sonnet
color: red
---

You are a security reviewer. Report findings with severity, file:line and a
concrete fix. Do not edit files.
```

What carries over when the definition is used for a **teammate**:

| Field | In-process teammate | Split-pane teammate |
| :- | :- | :- |
| `tools` | Applied. `SendMessage` and the Task tools are added automatically. | Applied |
| `model` | Applied unless the spawn prompt names one | Same |
| `disallowedTools` | Applied, but `SendMessage` and the Task tools stay | — |
| `effort` | Applied | — |
| Body | **Appended** to the default system prompt | **Replaces** the system prompt |
| `skills` | **Ignored**: loads project and user skills | Ignored |
| `mcpServers` | Ignored: uses project and user MCP | Applied |

Other frontmatter fields:

- Required: `name`, `description`.
- Optional: `permissionMode` (ignored for teammates, which inherit the
  lead's mode), `maxTurns`, `memory`, `background`, `omitClaudeMd`,
  `isolation`, `hooks`, `initialPrompt`, `experimental.cacheTtl`.

Writing a good `description`:

- Make it specific and action-oriented ("Reviews X … Use after Y").
- Keep it short: descriptions over 15k tokens in total trigger a warning.
- Put the detail in the body.

A definition from a project's `.claude/agents/` is re-applied to a
**revived** teammate only if that folder is trusted.

---

## 8. Quality gates with hooks

These events have no matcher support: they fire on every occurrence.
They are configured in `settings.json` under
`hooks.<Event>[].hooks[] = {type: "command", command, timeout}`.

| Event | Fires when | Exit 2 / `{"decision":"block","reason":…}` |
| :- | :- | :- |
| `TeammateIdle` | A teammate is about to go idle. Input: `agent_id`, `agent_type`. | Keeps it working (stderr is the feedback). `{"continue":false,"stopReason":…}` stops it entirely. |
| `TaskCreated` | `TaskCreate` is called. Input: `task_id`, `task_title`, `task_description`. | Cancels creation. The reason goes back to Claude. |
| `TaskCompleted` | A task is being marked complete. Input: plus `completion_message`. | Prevents completion. |

The most useful gate is to refuse completion while the build is broken:

```json
{
  "hooks": {
    "TaskCompleted": [
      { "hooks": [ { "type": "command", "command": ".claude/hooks/require-green-build.sh", "timeout": 300 } ] }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/require-green-build.sh — block task completion on type errors.
cat >/dev/null  # hook input (unused)
if ! out=$(node_modules/.bin/tsc --noEmit -p . 2>&1); then
  echo "TypeScript errors — fix before completing the task:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
```

---

## 9. When a team is the right tool

Use a team when the work is **parallel and independent**, and agents gain
from **talking to each other**:

- **Research and review**: several lenses on the same thing (security,
  performance, tests).
- **Competing hypotheses**: debugging where agents actively try to
  disprove each other. This beats anchoring on the first plausible theory.
- **New modules**: each teammate owns a separate piece.
- **Cross-layer work**: UI / data / tests, each with a different owner.

Don't use a team for:

- sequential work;
- edits to the **same files**;
- tasks with heavy dependencies between them;
- small tasks;
- anything where you only need a result back (use a subagent).

Rule of thumb: if you can't name 3+ chunks of work that touch **disjoint
files** and could start **right now**, don't build a team.

---

## 10. Designing an effective team

1. **Decompose by file ownership, not by activity.** Each teammate owns a
   disjoint set of files or directories. Two writers on one file means
   overwrites. If two roles need the same file, give it to one of them;
   the other sends requests by message.
2. **Team size: 3–5 to start.** Cost grows linearly and coordination
   overhead grows faster. Three focused teammates beat five scattered
   ones. With 15 independent tasks, start with 3 teammates.
3. **Task size: about 5–6 tasks per teammate.** Each task is self-contained
   with a clear deliverable (a function, a file, a review). Too small and
   overhead dominates. Too large and the teammate drifts without
   check-ins.
4. **Make the lead coordinate, not implement.** If it starts doing the
   work itself, say "Wait for your teammates to complete their tasks
   before proceeding."
5. **Assign a model per role.**
   - Sonnet for most teammates: the docs recommend it for cost.
   - The strongest model only for architecture or the hardest
     reasoning.
   - Haiku for mechanical checks.
6. **Build in disagreement where truth matters.** Use a devil's advocate or
   cross-examining investigators. Ask them to *disprove* each other, not
   to agree.
7. **Plan first for risky work.** Put the lead in plan mode before
   spawning. Remember that plan approval is automatic, so read the plans
   yourself if it matters.
8. **Define "done" up front.** Each task gets acceptance criteria and a
   verification command. Enforce it with a `TaskCompleted` hook (§8).
9. **Monitor and steer.** Check transcripts, redirect early, synthesize as
   results arrive. Never leave a team unattended for long.
10. **Shut teammates down when finished.** Idle teammates keep their
    context, and active ones keep spending tokens.

### Spawn prompt template

Teammates don't see the lead's conversation, so the spawn prompt is
**all** of their task context. Keep it focused, because everything in it
costs tokens from the first turn.

```text
Spawn an agent team. Use Sonnet for every teammate unless noted.

Goal: <one sentence, the user-visible outcome>.

Teammates (names are message addresses — use them exactly):
- `<name>` — owns <files/dirs>. Task: <what>. Done when: <check>.
- `<name>` — owns <files/dirs>. Task: <what>. Done when: <check>.
- `<name>` (Opus) — reviewer, read-only. Reviews each completed task
  against <criteria>; messages the owner directly with issues.

Shared context every teammate needs:
- <stack, conventions, constraints, decisions already made>
- <interfaces/contracts between teammates, e.g. function signatures>

Rules:
- Only edit files you own; ask the owner by message for anything else.
- Verify with `<command>` before marking a task complete.
- Do not commit, push, or touch the database — report to the lead instead.

Lead: create the tasks with dependencies, wait for teammates, then
synthesize a summary of what changed and anything unresolved.
```

### Ready-made recipes

**Parallel review (three lenses, no code changes):**

```text
Spawn three teammates to review the current diff (git diff main):
- `security` — RLS policies, auth checks, user_id scoping, secrets.
- `correctness` — logic bugs, offline/sync edge cases, demo-mode parity.
- `ux` — French copy, mobile layout at 375px, empty/error states.
Each reports findings with file:line and severity; challenge each other's
findings before the lead merges them into one list.
```

**Competing hypotheses (debugging):**

```text
<symptom>. Spawn 4 teammates, each owning one hypothesis: <H1>, <H2>, <H3>,
<H4>. Each gathers evidence for theirs AND tries to disprove the others',
messaging each other directly. Stop when one hypothesis survives; report
the evidence chain. No code changes until the lead confirms with me.
```

**Cross-layer feature:**

```text
Spawn a team for <feature>: `data` owns supabase/migrations/ + the feature's
api.ts + localDemo.ts; `ui` owns the feature's *Screen.tsx + globals.css;
`reviewer` (read-only) checks both against the rules in .ia/agents.md.
`data` publishes the TypeScript function signatures first as a task that
`ui`'s tasks depend on.
```

---

## 11. Rules specific to this repository

Teammates read `CLAUDE.md` and project settings but **not** the lead's
conversation. Put these rules in the spawn prompt, or have teammates read
`.ia/agents.md` first.

- **Only the lead commits, pushes and applies migrations.** In this repo,
  pushing to `main` deploys to production (Vercel), and new
  `supabase/migrations/*.sql` files are applied directly to the production
  database. Teammates must never do either.
- **A migration file is immutable once committed.** Changes always go in a
  new `NNNN_xxx.sql`. Give migrations to exactly one teammate.
- **Demo mode parity.** Every Supabase code path has a local fallback in
  `src/lib/localDemo.ts`. That makes it a hot spot for file conflicts:
  give it to one owner.
- **Updating `.ia/` is part of done.** Have the lead (or one docs owner)
  update `status.md`, `contexte-projet.md`, `architecture.md` and
  `decisions.md` at the end. Don't let several teammates edit them in
  parallel.
- **Verification commands:**
  - `node_modules/.bin/tsc --noEmit -p .` (fast)
  - `node_modules/.bin/next build` (full)
  - ESLint isn't configured, so `next lint` prompts interactively. Don't
    use it.
- **Environment:** WSL + VS Code integrated terminal. Use in-process
  display mode; split panes are unsupported here.
- **Ask before ambiguous design.** `.ia/agents.md` requires questions on
  ambiguous design choices. Teammates can't use `AskUserQuestion`, so they
  must escalate to the lead, and the lead asks the user.

---

## 12. Cost control

- The docs say teams use about **7× the tokens** of a single session when
  teammates run in plan mode. Cost scales with team size × run time.
- Use Sonnet for teammates, keep teams small, keep spawn prompts tight,
  and shut teammates down when done.
- An in-process teammate's prompt cache lasts **5 minutes** by default,
  even on a subscription. `subagentPromptCacheTtl: "1h"` keeps it longer,
  but 1-hour cache writes cost more.
- Check the subagent and teammate share of usage in `/usage`.

---

## 13. Troubleshooting and limitations

| Problem | Fix |
| :- | :- |
| No teammates appear | Check the agent panel (↑/↓). An idle row may just be hidden: message the teammate by name. The task may also be too small for Claude to form a team. Ask explicitly for an "agent team". |
| Subagents spawn instead of teammates | Ask explicitly for an agent team. Check the session is interactive and the variable is `1`. |
| Teammates spawn when you wanted subagents | Set the variable to `"0"` (no restart needed). Watch for higher-precedence settings that set `1`. |
| Too many permission prompts | Pre-approve common commands in permissions before spawning. |
| A teammate stopped early or after an error | Open its transcript and give it new instructions, or spawn a replacement. A message wakes a teammate waiting on an API retry. |
| The lead declares victory too early | Tell it to keep going until every task is complete. |
| A task stuck in progress | Teammates sometimes forget to mark tasks complete. Check the work, then update the status or have the lead nudge the teammate. |
| An orphaned tmux session | `tmux ls` then `tmux kill-session -t <name>`. |

Hard limitations:

- `/resume` and `/rewind` don't restore in-process teammates. The lead may
  message teammates that no longer exist: spawn new ones.
- One team per session. No nested teams: only the lead manages the team.
- The lead is fixed. You can't promote or transfer it.
- An in-process teammate's own subagents can't run in the background.
- Permission modes are set at spawn and are only changeable per teammate
  afterwards.
- Split panes need tmux or iTerm2.

---

## Pre-launch checklist

- [ ] Is a team really needed (§9)? Would one session or subagents do?
- [ ] 3–5 teammates, each owning **disjoint files**.
- [ ] Names, models and "done" checks written into the spawn prompt.
- [ ] The repo's rules (§11) are in the spawn prompt.
- [ ] Common commands pre-approved. In-process mode.
- [ ] Optional: a `TaskCompleted` hook gating on `tsc`.
- [ ] Plan mode on the lead first, if the work is risky.
- [ ] After the work: review the synthesis, shut the teammates down, then
      the lead updates `.ia/`, commits, pushes, and applies migrations.
