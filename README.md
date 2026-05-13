# dormant-users-action

A GitHub Action that detects **dormant organization members** by cross-referencing the [Organization Members API](https://docs.github.com/en/rest/orgs/members) with the [Audit Log API](https://docs.github.com/en/rest/orgs/orgs#get-the-audit-log-for-an-organization) — with **no per-user API requests**.

> **Plan requirement:** The GitHub Audit Log REST API is available on **GitHub Enterprise Cloud** and **GitHub Team** plans. It is not available on free-tier GitHub.com organizations.

---

## How it works

1. Fetch all organization members (paginated, single API family).
2. Fetch audit log events within the configured look-back window (paginated, one API family).
3. Extract unique `actor` logins from audit events.
4. Subtract active actors from the full member list → dormant users.

API calls scale with **pages**, not with member count. No per-user queries are ever made.

---

## Required permissions

The token supplied to `token` must have:

| Scope | Why |
|---|---|
| `read:org` | List organization members |
| `read:audit_log` | Read organization audit log |

Create a **classic PAT** or a **fine-grained token** with these scopes and store it as a repository/organization secret (e.g. `ORG_AUDIT_LOG_TOKEN`).

The `GITHUB_TOKEN` provided by Actions does **not** have `read:audit_log` — you must use a dedicated PAT.

---

## Usage

```yaml
- name: Detect Dormant Users
  id: dormant
  uses: matdumo-and/dormant-users-action@v1
  with:
    org: my-org
    token: ${{ secrets.ORG_AUDIT_LOG_TOKEN }}
    days: '90'
    include-bots: 'false'
    phrases: |
      action:repo.push
      action:pull_request.opened
```

### Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `org` | yes | — | GitHub organization name |
| `token` | yes | — | PAT with `read:org` + `read:audit_log` |
| `days` | no | `90` | Look-back window in days (1–3650) |
| `phrases` | no | — | Additional audit log filters, one per line (OR-combined) |
| `include-bots` | no | `false` | Include bot accounts in the check |
| `debug` | no | `false` | Verbose debug logging |

### Outputs

| Output | Description |
|---|---|
| `dormant-users-json` | JSON array `[{login, id}]` |
| `dormant-users-csv` | CSV with header `login,id` |
| `dormant-users-count` | Integer count |

```yaml
- run: echo "Dormant count: ${{ steps.dormant.outputs.dormant-users-count }}"
- run: echo '${{ steps.dormant.outputs.dormant-users-json }}' > report.json
```

---

## Recommended `phrases`

`phrases` filters which audit log events count as activity. Any user who appears as `actor` in a matching event is considered **active**.

```yaml
phrases: |
  action:repo.push          # pushed code
  action:pull_request.opened
  action:pull_request.merged
  action:issues.opened
  action:issues.closed
  action:org.invite_member  # invited someone (admin activity)
  action:team.add_member
```

Leave `phrases` empty to count **any** audit log event as activity (broadest definition).

### Forbidden phrases

The action rejects any phrase containing:

- `created:` — the date window is always set by the `days` input
- `actor:` — would allow bypassing the dormant check for specific users
- `actor_is_bot:` — controlled by the `include-bots` input
- Shell metacharacters (`;`, `|`, `&`, `` ` ``, `$`, `<`, `>`, `\`, `'`, `"`)

---

## Limitations of the GitHub Audit Log

| Limitation | Detail |
|---|---|
| **Plan requirement** | Audit Log REST API requires Enterprise Cloud or Team plan |
| **Retention** | Audit logs are retained for 90 days (Team) or 180 days (Enterprise Cloud) by default. Setting `days` beyond retention returns incomplete results. |
| **Activity scope** | Only captures activity that generates an audit event. Read-only browsing (e.g. viewing issues) does not appear in the log. |
| **Bot filtering** | `actor_is_bot:false` is applied automatically when `include-bots: false`. On some plans this qualifier may not be supported; the action still produces correct output because bots rarely appear as org members. |
| **Large orgs** | Responses are buffered up to 100 MB. Extremely large audit log windows may exhaust memory on the runner. Reduce `days` or add `phrases` filters to narrow results. |
| **Clock skew** | Cutoff date is computed at action start time. Events within the final few seconds of the window may be missed. |

---

## Full example workflow

See [`.github/workflows/example.yml`](.github/workflows/example.yml) for a complete scheduled workflow that uploads a JSON artifact and writes a step summary.

---

## Development

```bash
# Install dependencies
pnpm install

# Build (outputs to dist/)
pnpm build

# Run tests
pnpm test

# Type-check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

### Repository structure

```
src/
  index.ts       — orchestration entry point
  inputs.ts      — parse & validate @actions/core inputs
  validation.ts  — zod schemas + phrase safety rules
  github.ts      — gh CLI wrapper (ghApiList, error types, auth checks)
  members.ts     — fetchOrgMembers()
  auditlog.ts    — buildAuditLogQuery(), getCutoffDate(), fetchActiveActors()
  outputs.ts     — formatJson(), formatCsv(), setOutputs()
tests/
  validation.test.ts  — zod schema & phrase rejection tests
  auditlog.test.ts    — query builder & cutoff date tests
  dormant.test.ts     — dormant computation & output format tests
dist/
  index.js       — bundled action entry point (committed, required by runner)
```

---

## License

MIT
