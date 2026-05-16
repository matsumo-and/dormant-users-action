import { ghApiList } from './github.js';
import { log } from './logger.js';

/** Minimal shape of a GitHub audit log event used by this action. */
export type AuditLogEvent = {
  /** Login of the user who performed the action. */
  actor?: string;
  /** Audit log action identifier (e.g. `"repo.create"`). */
  action?: string;
  /** Unix timestamp (ms) when the event occurred. */
  created_at?: number;
};

/**
 * Returns midnight (UTC) of the date that is `days` calendar days before today.
 *
 * @param days - Number of days to look back (must be ≥ 1).
 */
export function getCutoffDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Builds a GitHub audit log search phrase for the `GET /orgs/:org/audit-log`
 * endpoint, combining a `created:>=YYYY-MM-DD` filter with any caller-supplied
 * phrases joined by `OR`.
 *
 * @param cutoff - Earliest date to include; time component is ignored.
 * @param phrases - Pre-validated search phrases (may be empty).
 * @returns A URL-safe audit log query string.
 */
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

/**
 * Queries the GitHub organization audit log and returns the set of unique
 * actor logins that appear in any matching event.
 *
 * @param org - GitHub organization login.
 * @param token - GitHub token with `read:audit_log` scope.
 * @param query - Audit log search phrase built by {@link buildAuditLogQuery}.
 * @returns Set of login strings for users who had at least one audit log event.
 * @throws {GhApiError} If the audit log API request fails.
 */
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
  let eventsWithoutActor = 0;
  for (const event of events) {
    if (typeof event.actor === 'string' && event.actor.length > 0) {
      actors.add(event.actor);
    } else {
      eventsWithoutActor++;
    }
  }

  log(
    `Audit log: ${events.length.toString()} events → ${actors.size.toString()} unique actors` +
      (eventsWithoutActor > 0
        ? ` (${eventsWithoutActor.toString()} events had no actor field)`
        : ''),
  );

  return actors;
}
