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
- **Docs impact** (required): one of:
  - `Docs impact: none`
  - `Docs impact: README.md`
  - `Docs impact: CLAUDE.md`
  - `Docs impact: AGENTS.md`
  - `Docs impact: follow-up issue #<id>` (with explicit rationale for deferral)

If a PR changes any of the following, docs must be reviewed explicitly before merge:
- architecture shape
- runtime backend
- auth model
- setup / onboarding path
- built-in provider behavior

If docs/tests are intentionally deferred, the PR must link a specific follow-up issue and state why deferral is acceptable.

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

Before patching any review finding, ClaudeCode must:
1. State the classification (A/B/C below)
2. Restate the technical invariant being protected (e.g. "activeRequests must always decrement on every exit path")
3. Check all related exit paths / call sites for the same class of defect before writing any code

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

**Built-in agent smoke validation (required for provider/runtime changes):**

When a PR touches any of: provider adapter, bridge runtime, streaming logic, auth model, CLI wiring — the validation bar must include a local smoke check for built-in agents before requesting review:

- built-in Claude agent: send a simple `hello` request, verify a non-empty response is returned
- built-in Codex agent: send a simple `hello` request, verify a non-empty response is returned

Include the smoke check result (pass/fail + observed output) in the PR validation section.

For async stream / generator subsystems, explicitly trace all exit paths before patching:
- normal completion
- timeout
- yielded error event
- thrown error
- client abort

If tests cannot run:
- say so explicitly
- explain why
- provide best-effort manual verification steps

When debugging intertwined failure modes in one subsystem:
- model all exit paths first with hypothesis logs
- identify the shared root cause before writing any patch
- do not patch one exit path in isolation if others share the same invariant

---

## 12. Forbidden behavior

Do not:
- commit directly to `master`
- rewrite unrelated files
- silently rename core concepts
- change public interfaces without documenting it
- fix extra issues "while here" unless explicitly approved
- collapse multiple concerns into one PR
- override human decisions on scope

---

## 13. Preferred collaboration pattern

Default pattern:
1. For cross-layer changes (UI model, bridge API, Redis schema, docs), write a short design doc listing explicit invariants and "not allowed" fields before touching code
2. ClaudeCode implements from issue on a feature/fix branch
3. PR opened to GitHub
4. Codex reviews the PR
5. Findings are classified as in-scope small / in-scope risky / out-of-scope
6. ClaudeCode fixes small in-scope findings on same branch
7. Larger or out-of-scope findings become follow-up issues / PRs
8. Human decides merge timing and scope boundaries

---

## 14. Definition of done

A PR is ready to merge only if:
- linked issue scope is satisfied
- blocking review comments are resolved
- tests/docs are updated as needed
- risks are documented
- no unresolved scope ambiguity remains
- for stream/async subsystems: all exit paths (normal, timeout, yielded error, thrown error, client abort) have been explicitly verified
- **docs impact field is present and addressed** — if docs were deferred, a follow-up issue must be linked
- **for provider/runtime/auth/setup/streaming/CLI changes: built-in agent smoke check passed** and result is documented in PR

Correct and small beats clever and sprawling.

---

## 15. Review conclusion protocol

Reviewer findings must be posted as PR review comments or inline comments on GitHub — not only summarized in chat.

After completing a review pass:
- if blocking findings remain: publish an explicit **Request changes** review on the PR
- if no blocking findings remain: publish an explicit **Approve** review on the PR
- resolving threads alone does not replace a final review conclusion

After re-review:
- reviewer must update the PR with the current verdict (approve or request changes)
- do not leave the final state implicit

---

## 16. Collaborator close-out flow

This flow applies only when the human maintainer has explicitly delegated close-out authority (e.g. "go ahead and merge"). Section 3 remains the default: the human maintainer is the final decision-maker for merge. When delegated, the expected flow is:

1. Review findings are posted to the PR
2. Author addresses feedback and requests re-review
3. Reviewer re-checks and publishes the final review conclusion on the PR
4. Collaborator performs close-out:
   - approve the PR on GitHub
   - merge using the repository's normal merge style
   - verify linked issue closure behavior (auto-close via `Closes #N` in PR body)
   - manually close linked issues if auto-close does not trigger
   - sync local `master`: `git checkout master && git pull origin master`
   - clean up temporary branches: delete remote fix branch after merge, delete local branch
