# CLAUDE.md — Project instructions for Claude Code

## Pre-commit gate (mandatory)

Before running **any** `git commit`, you MUST run the following checks in order and fix all failures before proceeding:

```bash
pnpm format:check   # Prettier — formatting must be clean
pnpm lint           # ESLint — no errors allowed
pnpm test           # Vitest — all tests must pass
```

If `format:check` fails, run `pnpm format` to auto-fix, then re-verify.
If `lint` or `test` fail, fix the root cause — do not bypass with `--no-verify` or skip the step.

## Build

```bash
pnpm build   # tsup bundles src/ → dist/index.js
```

Run `pnpm build` after source changes that will be committed so `dist/index.js` stays in sync.

## Project layout

```
src/
  index.ts       — entry point, orchestrates the 3-step flow
  inputs.ts      — parses @actions/core inputs via Zod
  validation.ts  — Zod schema + phrase safety rules
  github.ts      — ghApiList<T> wrapper around `gh api --paginate --jq '.[]'`
  members.ts     — fetchOrgMembers()
  auditlog.ts    — buildAuditLogQuery(), getCutoffDate(), fetchActiveActors()
  outputs.ts     — formatJson(), formatCsv(), setOutputs()
tests/
  validation.test.ts
  auditlog.test.ts
  dormant.test.ts
dist/            — committed bundle (required by the Actions runner)
```

## Key constraints

- **No per-user API calls.** All detection is done via two paginated API families (members + audit log).
- **Phrase injection is forbidden.** Never construct audit log queries with unvalidated user input. All phrases go through `InputSchema` in `validation.ts`.
- **No `any`.** TypeScript strict mode is enforced; ESLint errors on `@typescript-eslint/no-explicit-any`.
- **ESM only.** `"type": "module"` — all imports use `.js` extensions.
- **`dist/` is committed.** The GitHub Actions runner loads `dist/index.js` directly; do not add `dist/` back to `.gitignore`.

## Toolchain

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22 (build) / 20 (runtime) | Build environment / action runner |
| pnpm | 10 | Package manager |
| TypeScript | 5.x strict + NodeNext | Language |
| tsup | 8.x | Bundles src → dist (ESM) |
| Vitest | 2.x | Unit tests |
| ESLint | 8.x + @typescript-eslint/v7 | Linting |
| Prettier | 3.x | Formatting |
