# Agents.md — Guide for AI coding agents

This document describes the conventions, constraints, and required checks for AI agents working on this repository.

## Pre-commit gate (mandatory)

**Do not commit unless all three checks pass.**

```bash
pnpm format:check   # must exit 0
pnpm lint           # must exit 0
pnpm test           # must exit 0
```

Run them in that order. Fix failures before committing — never skip or bypass them.

| Check | Fix command | What it enforces |
|---|---|---|
| `pnpm format:check` | `pnpm format` | Prettier code style |
| `pnpm lint` | fix source manually | ESLint + TypeScript rules |
| `pnpm test` | fix source manually | All Vitest unit tests |

## After source changes: rebuild dist

The GitHub Actions runner loads `dist/index.js` directly. Keep it in sync:

```bash
pnpm build
git add dist/index.js
```

## What this action does

Detects dormant GitHub organization members using:

1. `GET /orgs/{org}/members` — full member list (paginated)
2. `GET /orgs/{org}/audit-log?phrase=...` — audit log activity (paginated)
3. Set subtraction: members not in audit log actors → dormant

Executed via `gh api --paginate --jq '.[]'` (NDJSON output). Zero per-user API calls.

## Constraints agents must respect

### Never add per-user API calls
All detection must remain O(pages), not O(members). Do not introduce loops that call an API endpoint per member.

### Phrase injection guard
User-supplied `phrases` input is validated by `InputSchema` in `src/validation.ts`.
- Never build an audit log query string from raw, unvalidated input.
- Never relax the dangerous-pattern checks (`created:`, `actor:`, `actor_is_bot:`, shell metacharacters).

### No `any`
ESLint is configured with `@typescript-eslint/no-explicit-any: error`. Use `unknown` and narrow types explicitly.

### ESM imports require `.js` extensions
```ts
// correct
import { foo } from './foo.js';
// wrong — breaks NodeNext module resolution
import { foo } from './foo';
```

### `dist/` is committed
The Actions runner reads `dist/index.js` at job time. Do not add `dist/` to `.gitignore`.

## File responsibilities

| File | Responsibility |
|---|---|
| `src/validation.ts` | Zod schema, phrase safety rules |
| `src/inputs.ts` | Reads `@actions/core` inputs, runs schema |
| `src/github.ts` | `ghApiList<T>`, `GhApiError`, `checkGhCli`, `verifyToken` |
| `src/members.ts` | `fetchOrgMembers` — filters bots by `type` field |
| `src/auditlog.ts` | `buildAuditLogQuery`, `getCutoffDate`, `fetchActiveActors` |
| `src/outputs.ts` | `formatJson`, `formatCsv`, `setOutputs` |
| `src/index.ts` | Orchestration, debug logging, `core.setFailed` |

## Test coverage areas

When adding new logic, add corresponding tests:

- Validation rules → `tests/validation.test.ts`
- Query builder / date math → `tests/auditlog.test.ts`
- Dormant computation / output formats → `tests/dormant.test.ts`

## CI

The CI workflow (`.github/workflows/ci.yml`) runs Format → Lint → Test → Build on every push and PR to `main`. A passing CI is required before merging.
