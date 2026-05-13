import * as core from '@actions/core';
import { OrgMember } from './members.js';

export function formatJson(users: OrgMember[]): string {
  return JSON.stringify(
    users.map(({ login, id }) => ({ login, id })),
    null,
    2,
  );
}

export function formatCsv(users: OrgMember[]): string {
  const rows = users.map(({ login, id }) => `${login},${id.toString()}`);
  return ['login,id', ...rows].join('\n');
}

export function setOutputs(dormantUsers: OrgMember[]): void {
  core.setOutput('dormant-users-json', formatJson(dormantUsers));
  core.setOutput('dormant-users-csv', formatCsv(dormantUsers));
  core.setOutput('dormant-users-count', dormantUsers.length.toString());
}
