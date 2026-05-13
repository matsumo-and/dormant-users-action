import { ghApiList } from './github.js';

export type AuditLogEvent = {
  actor?: string;
  action?: string;
  created_at?: number;
};

export function getCutoffDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function buildAuditLogQuery(
  cutoff: Date,
  phrases: string[],
  includeBots: boolean,
): string {
  const dateStr = cutoff.toISOString().split('T')[0];

  const parts: string[] = [`created:>=${dateStr}`];

  if (phrases.length === 1) {
    parts.push(phrases[0] as string);
  } else if (phrases.length > 1) {
    parts.push(`(${phrases.join(' OR ')})`);
  }

  if (!includeBots) {
    parts.push('actor_is_bot:false');
  }

  return parts.join(' ');
}

export async function fetchActiveActors(
  org: string,
  token: string,
  query: string,
): Promise<Set<string>> {
  const events = await ghApiList<AuditLogEvent>(`/orgs/${org}/audit-log`, {
    env: { GH_TOKEN: token },
    fields: { phrase: query },
  });

  const actors = new Set<string>();
  for (const event of events) {
    if (typeof event.actor === 'string' && event.actor.length > 0) {
      actors.add(event.actor);
    }
  }
  return actors;
}
