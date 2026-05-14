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

export function buildAuditLogQuery(cutoff: Date, phrases: string[]): string {
  const dateStr = cutoff.toISOString().split('T')[0];

  const parts: string[] = [`created:>=${dateStr}`];

  if (phrases.length === 1) {
    parts.push(phrases[0]);
  } else if (phrases.length > 1) {
    parts.push(`(${phrases.join(' OR ')})`);
  }

  return parts.join(' ');
}

export async function fetchActiveActors(
  org: string,
  token: string,
  query: string,
): Promise<Set<string>> {
  // Embed phrase as a URL query parameter directly. Using -f phrase=... sends
  // it as a request body field which causes 404 on this GET endpoint.
  const endpoint = `/orgs/${org}/audit-log?phrase=${encodeURIComponent(query)}`;
  const events = await ghApiList<AuditLogEvent>(endpoint, {
    env: { GH_TOKEN: token },
  });

  const actors = new Set<string>();
  for (const event of events) {
    if (typeof event.actor === 'string' && event.actor.length > 0) {
      actors.add(event.actor);
    }
  }
  return actors;
}
