# AGENTS.md

## 1. Mission

This repository is developed through multi-agent collaboration.

Primary workflow:
- ClaudeCode = main implementer
- Codex = reviewer / issue driver / small scoped fixer
- GitHub = single source of truth for code status, task status, and review history

Local clones are working copies only.
Do not treat unpushed local changes as authoritative.

---

## 2. Source of truth

The only source of truth is the GitHub remote repository.

Use GitHub for:
- Issues: task tracking, bug reports, design concerns
- Pull Requests: code review, discussion, and merge decisions
- Branches: isolation of work
- PR comments / reviews: review protocol

Do not coordinate through chat alone when a change affects code, interface, or architecture.

---

## 3. Agent roles

### ClaudeCode
Primary responsibilities:
- feature implementation
- refactor
- multi-file code changes
- issue-driven fixes
- code generation aligned with repository conventions

ClaudeCode should:
- prefer implementing accepted issue scope
- avoid silent architecture drift
- avoid changing public interfaces without documenting it
- keep changes focused on the assigned issue or PR scope

### Codex
Primary responsibilities:
- repository analysis
- code review
- issue creation
- test hardening
- docs improvement
- small scoped fixes after review

Codex should:
- prefer review comments or issues before large code edits
- avoid unrelated refactors inside review fixes
- avoid rewriting the same subsystem already under active ClaudeCode ownership
- create narrow repair branches for small patches when needed

### Human maintainer
Final decision-maker for:
- merge
- scope changes
- architecture tradeoffs
- issue priority
- conflict resolution

---

## 4. Branch policy

Never commit directly to `main`.

Branch naming:
- `feature/<topic>`: new implementation
- `fix/issue-<id>-<topic>`: issue-driven fix
- `review/<topic>`: Codex analysis or validation branch
- `hotfix/<topic>`: urgent production fix

Rules:
- One active writer per branch
- Reviewer should not silently take over the author's branch
- Large fixes discovered during review must not be mixed into unrelated PRs
- If scope expands materially, open a new issue

---

## 5. Issue protocol

Every non-trivial problem should be represented in a GitHub Issue.

Issue template should include:
- Problem
- Observed behavior
- Suspected root cause
- Impact scope
- Proposed fix
- Acceptance criteria
- Risk / compatibility notes

Labels recommended:
- `bug`
- `review-found`
- `follow-up`
- `scope-change`
- `refactor`
- `test-gap`
- `docs`

When review discovers a new problem:
- use `review-found` if discovered during PR review
- use `follow-up` if it should be fixed separately
- use `scope-change` if fixing it changes the original PR intent

---

## 6. Pull request protocol

Every PR must contain:
- What changed
- Why it changed
- What was not changed
- Risks
- Validation steps
- Linked issue(s)

Preferred PR size:
- keep focused
- avoid unrelated file churn
- avoid opportunistic refactor unless explicitly in scope

PR status guidance:
- Draft PR = implementation still moving
- Ready for review = author believes issue scope is complete

---

## 7. Review decision rules

Codex reviewing a ClaudeCode PR must classify findings into one of 3 buckets:

### A. In-scope and small
Examples:
- edge case missed
- typing/import issue
- incorrect variable name
- missing test for same logic path
- minor docs mismatch

Action:
- leave review comments or request changes on the same PR
- ClaudeCode fixes on the same branch
- keep within current issue scope

### B. In-scope but medium/high risk
Examples:
- bug fix affects multiple modules
- behavior change requires interface update
- non-trivial migration or contract change
- test strategy must be redesigned

Action:
- keep PR open
- file a sub-issue or checklist item in the PR
- ClaudeCode may continue on the same branch only if PR goal remains the same
- otherwise split into a follow-up PR

### C. Out-of-scope or architectural
Examples:
- reviewer found a different design flaw
- broader refactor is required
- unrelated subsystem is broken
- a latent issue is exposed but not necessary for current merge

Action:
- do not bloat the current PR
- open a new issue
- label as `follow-up` or `scope-change`
- decide one of:
  - merge current PR after addressing blocking items
  - or stop current PR and replace with a redesigned one

---

## 8. Same PR vs new PR rule

Use the SAME PR only when all are true:
- same business intent
- same subsystem boundary
- low review risk
- no public contract expansion
- no major increase in changed files

Open a NEW issue / NEW PR when any is true:
- architecture changes
- public API/schema changes
- touches unrelated modules
- significantly expands diff size
- changes original acceptance criteria
- needs separate rollback path

Rule of thumb:
- if the review finding changes "what this PR is", split it
- if it only changes "how this PR becomes correct", keep it in the same PR

---

## 9. Re-review protocol

After ClaudeCode addresses review feedback:
- summarize each resolved review item in a comment
- push focused commits
- request re-review from Codex / reviewer
- do not mark unrelated comments as resolved without code or rationale

If a review item is intentionally not fixed:
- reply with explicit rationale
- propose follow-up issue if needed
- wait for reviewer/human decision before merge

---

## 10. Change ownership rules

When ClaudeCode owns an implementation branch:
- Codex should review first
- Codex may create a separate fix branch only for narrow, approved, low-risk patches

When Codex creates a repair branch:
- keep scope minimal
- avoid broad refactor
- reference original PR / issue clearly

Never let two agents perform broad edits concurrently on the same branch.

---

## 11. Testing rules

Before requesting review, run the relevant checks for touched areas.

Minimum expectation:
- run unit tests for modified modules
- run lint / typecheck if configured
- include exact validation commands in the PR description

If tests cannot run:
- say so explicitly
- explain why
- provide best-effort manual verification steps

---

## 12. Forbidden behavior

Do not:
- commit directly to `main`
- rewrite unrelated files
- silently rename core concepts
- change public interfaces without documenting it
- fix extra issues "while here" unless explicitly approved
- collapse multiple concerns into one PR
- override human decisions on scope

---

## 13. Preferred collaboration pattern

Default pattern:
1. ClaudeCode implements from issue on a feature/fix branch
2. PR opened to GitHub
3. Codex reviews the PR
4. Findings are classified as in-scope small / in-scope risky / out-of-scope
5. ClaudeCode fixes small in-scope findings on same branch
6. Larger or out-of-scope findings become follow-up issues / PRs
7. Human decides merge timing and scope boundaries

---

## 14. Definition of done

A PR is ready to merge only if:
- linked issue scope is satisfied
- blocking review comments are resolved
- tests/docs are updated as needed
- risks are documented
- no unresolved scope ambiguity remains

Correct and small beats clever and sprawling.
