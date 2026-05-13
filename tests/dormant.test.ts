import { describe, it, expect } from 'vitest';
import { formatJson, formatCsv } from '../src/outputs.js';
import { OrgMember } from '../src/members.js';

function computeDormant(members: OrgMember[], activeActors: Set<string>): OrgMember[] {
  return members.filter(({ login }) => !activeActors.has(login));
}

const MEMBERS: OrgMember[] = [
  { login: 'alice', id: 1, type: 'User' },
  { login: 'bob', id: 2, type: 'User' },
  { login: 'charlie', id: 3, type: 'User' },
  { login: 'dave', id: 4, type: 'User' },
  { login: 'bot-service', id: 5, type: 'Bot' },
];

describe('computeDormant', () => {
  it('marks all members dormant when no one was active', () => {
    const dormant = computeDormant(MEMBERS, new Set());
    expect(dormant).toHaveLength(5);
  });

  it('excludes active users', () => {
    const dormant = computeDormant(MEMBERS, new Set(['alice', 'charlie']));
    expect(dormant.map((u) => u.login)).toEqual(['bob', 'dave', 'bot-service']);
  });

  it('returns empty array when every member was active', () => {
    const active = new Set(MEMBERS.map((m) => m.login));
    expect(computeDormant(MEMBERS, active)).toHaveLength(0);
  });

  it('ignores audit log actors who are not org members', () => {
    const active = new Set(['external-contributor', 'alice']);
    const dormant = computeDormant(MEMBERS, active);
    expect(dormant.map((u) => u.login)).toEqual(['bob', 'charlie', 'dave', 'bot-service']);
  });

  it('is case-sensitive on login comparison', () => {
    const dormant = computeDormant(MEMBERS, new Set(['Alice']));
    expect(dormant.some((u) => u.login === 'alice')).toBe(true);
  });
});

describe('formatJson', () => {
  it('outputs valid JSON array', () => {
    const json = formatJson([{ login: 'foo', id: 123, type: 'User' }]);
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ login: 'foo', id: 123 });
  });

  it('strips the type field from output', () => {
    const json = formatJson([{ login: 'bot', id: 5, type: 'Bot' }]);
    const parsed = JSON.parse(json) as Array<{ type?: string }>;
    expect(parsed[0]).not.toHaveProperty('type');
  });

  it('returns empty array for no dormant users', () => {
    expect(formatJson([])).toBe('[]');
  });
});

describe('formatCsv', () => {
  it('includes header row', () => {
    const csv = formatCsv([]);
    expect(csv).toBe('login,id');
  });

  it('formats rows correctly', () => {
    const csv = formatCsv([
      { login: 'alice', id: 1, type: 'User' },
      { login: 'bob', id: 2, type: 'User' },
    ]);
    expect(csv).toBe('login,id\nalice,1\nbob,2');
  });
});
