import { describe, it, expect } from 'vitest';
import { buildAuditLogQuery, getCutoffDate } from '../src/auditlog.js';

const FIXED = new Date('2026-01-13T00:00:00.000Z');

describe('buildAuditLogQuery', () => {
  it('builds minimal query with no phrases, bots excluded', () => {
    expect(buildAuditLogQuery(FIXED, [], false)).toBe('created:>=2026-01-13 actor_is_bot:false');
  });

  it('omits actor_is_bot when includeBots=true', () => {
    expect(buildAuditLogQuery(FIXED, [], true)).toBe('created:>=2026-01-13');
  });

  it('appends a single phrase without parentheses', () => {
    expect(buildAuditLogQuery(FIXED, ['action:repo.push'], false)).toBe(
      'created:>=2026-01-13 action:repo.push actor_is_bot:false',
    );
  });

  it('wraps multiple phrases in OR group', () => {
    expect(
      buildAuditLogQuery(FIXED, ['action:repo.push', 'action:pull_request.opened'], false),
    ).toBe(
      'created:>=2026-01-13 (action:repo.push OR action:pull_request.opened) actor_is_bot:false',
    );
  });

  it('handles three phrases in OR group', () => {
    expect(
      buildAuditLogQuery(
        FIXED,
        ['action:repo.push', 'action:pull_request.opened', 'action:issues.opened'],
        true,
      ),
    ).toBe(
      'created:>=2026-01-13 (action:repo.push OR action:pull_request.opened OR action:issues.opened)',
    );
  });
});

describe('getCutoffDate', () => {
  it('returns a date strictly in the past', () => {
    const cutoff = getCutoffDate(90);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it('returns a date with time zeroed to midnight', () => {
    const cutoff = getCutoffDate(30);
    expect(cutoff.getHours()).toBe(0);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getSeconds()).toBe(0);
    expect(cutoff.getMilliseconds()).toBe(0);
  });

  it('returns approximately N days in the past', () => {
    const cutoff = getCutoffDate(30);
    const diffDays = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('handles boundary value of 1 day', () => {
    const cutoff = getCutoffDate(1);
    const diffDays = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(0.9);
    expect(diffDays).toBeLessThanOrEqual(2);
  });
});
