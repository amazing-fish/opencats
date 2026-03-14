# AGENTS.md

## Source of truth
- GitHub remote is the only source of truth.
- Never assume local unpushed changes are authoritative.

## Roles
- ClaudeCode: implementation, refactor, multi-file changes.
- Codex: review, issue creation, test hardening, small scoped fixes.

## Branch rules
- Never commit directly to main.
- Use feature/* for implementation.
- Use fix/issue-* for issue-driven repair.

## Before editing
- Read README.md, ARCHITECTURE.md, and relevant module entrypoints.
- Summarize intended change before modifying more than 3 files.

## Forbidden
- Do not rewrite unrelated files.
- Do not silently rename core entities.
- Do not change public interfaces without updating docs/tests.

## Required in PR
- What changed
- Why
- Risks
- Validation steps
