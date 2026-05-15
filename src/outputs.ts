import * as core from '@actions/core';
import { OrgMember } from './members.js';

/**
 * Serializes a list of dormant users as a pretty-printed JSON array of
 * `{ login, id }` objects.
 */
export function formatJson(users: OrgMember[]): string {
  return JSON.stringify(
    users.map(({ login, id }) => ({ login, id })),
    null,
    2,
  );
}

/**
 * Serializes a list of dormant users as a CSV string with a `login,id` header
 * row followed by one row per user.
 */
export function formatCsv(users: OrgMember[]): string {
  const rows = users.map(({ login, id }) => `${login},${id.toString()}`);
  return ['login,id', ...rows].join('\n');
}

/**
 * Writes the action's three step outputs:
 * - `dormant-users-json` — JSON array of `{ login, id }` objects
 * - `dormant-users-csv`  — CSV with `login,id` header
 * - `dormant-users-count` — total number of dormant users
 */
export function setOutputs(dormantUsers: OrgMember[]): void {
  core.setOutput('dormant-users-json', formatJson(dormantUsers));
  core.setOutput('dormant-users-csv', formatCsv(dormantUsers));
  core.setOutput('dormant-users-count', dormantUsers.length.toString());
}
