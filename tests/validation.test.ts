import { describe, it, expect } from 'vitest';
import { InputSchema } from '../src/validation.js';

const BASE = {
  org: 'my-org',
  token: 'ghp_xxxxxxxxxxxxxxxxxxxx',
  days: '90',
  includeBots: 'false' as const,
};

describe('InputSchema — org', () => {
  it('accepts a valid org name', () => {
    expect(InputSchema.safeParse({ ...BASE }).success).toBe(true);
  });

  it('rejects an empty org', () => {
    const r = InputSchema.safeParse({ ...BASE, org: '' });
    expect(r.success).toBe(false);
  });
});

describe('InputSchema — token', () => {
  it('rejects an empty token', () => {
    const r = InputSchema.safeParse({ ...BASE, token: '' });
    expect(r.success).toBe(false);
  });
});

describe('InputSchema — days', () => {
  it('coerces string to number', () => {
    const r = InputSchema.safeParse({ ...BASE, days: '30' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.days).toBe(30);
  });

  it('rejects 0', () => {
    expect(InputSchema.safeParse({ ...BASE, days: '0' }).success).toBe(false);
  });

  it('rejects 3651', () => {
    expect(InputSchema.safeParse({ ...BASE, days: '3651' }).success).toBe(false);
  });

  it('accepts boundary values 1 and 3650', () => {
    expect(InputSchema.safeParse({ ...BASE, days: '1' }).success).toBe(true);
    expect(InputSchema.safeParse({ ...BASE, days: '3650' }).success).toBe(true);
  });

  it('rejects a float', () => {
    expect(InputSchema.safeParse({ ...BASE, days: '30.5' }).success).toBe(false);
  });
});

describe('InputSchema — includeBots', () => {
  it('transforms "true" to boolean true', () => {
    const r = InputSchema.safeParse({ ...BASE, includeBots: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.includeBots).toBe(true);
  });

  it('rejects non-boolean strings', () => {
    expect(InputSchema.safeParse({ ...BASE, includeBots: 'yes' }).success).toBe(false);
  });
});

describe('InputSchema — phrases', () => {
  it('returns empty array when phrases is undefined', () => {
    const r = InputSchema.safeParse({ ...BASE });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phrases).toEqual([]);
  });

  it('splits on newline and trims blank lines', () => {
    const r = InputSchema.safeParse({
      ...BASE,
      phrases: 'action:repo.push\n\naction:pull_request.opened\n',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phrases).toEqual(['action:repo.push', 'action:pull_request.opened']);
    }
  });

  it('rejects phrases containing created:', () => {
    expect(InputSchema.safeParse({ ...BASE, phrases: 'created:>=2020-01-01' }).success).toBe(false);
  });

  it('rejects phrases containing actor:', () => {
    expect(InputSchema.safeParse({ ...BASE, phrases: 'actor:octocat' }).success).toBe(false);
  });

  it('rejects phrases containing actor_is_bot:', () => {
    expect(InputSchema.safeParse({ ...BASE, phrases: 'actor_is_bot:true' }).success).toBe(false);
  });

  it('rejects phrases with shell metacharacters', () => {
    expect(InputSchema.safeParse({ ...BASE, phrases: 'action:repo.push; rm -rf /' }).success).toBe(
      false,
    );
    expect(InputSchema.safeParse({ ...BASE, phrases: 'action:repo.push && echo hi' }).success).toBe(
      false,
    );
    expect(
      InputSchema.safeParse({ ...BASE, phrases: 'action:repo.push | tee /tmp/x' }).success,
    ).toBe(false);
  });

  it('rejects phrases with embedded newlines (injection attempt)', () => {
    expect(
      InputSchema.safeParse({ ...BASE, phrases: 'action:repo.push\nactor:evil' }).success,
    ).toBe(false);
  });

  it('accepts safe phrases', () => {
    const r = InputSchema.safeParse({
      ...BASE,
      phrases: 'action:repo.push\naction:issues.opened',
    });
    expect(r.success).toBe(true);
  });
});
