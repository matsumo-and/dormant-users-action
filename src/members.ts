import * as core from '@actions/core';
import { z } from 'zod';
import { ghApiList } from './github.js';

/** Zod schema for a single GitHub organization member returned by `GET /orgs/:org/members`. */
export const OrgMemberSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string().default('User'),
});

/** A validated GitHub organization member. */
export type OrgMember = z.infer<typeof OrgMemberSchema>;

/**
 * Fetches all members of a GitHub organization and optionally filters out bots.
 *
 * @param org - GitHub organization login (e.g. `"my-org"`).
 * @param token - GitHub token with `read:org` scope.
 * @param includeBots - When `false`, members whose `type` is `"Bot"` are excluded.
 * @returns Parsed and (optionally) filtered list of organization members.
 * @throws {GhApiError} If the API request fails.
 * @throws {Error} If any response item cannot be parsed against {@link OrgMemberSchema}.
 */
export async function fetchOrgMembers(
  org: string,
  token: string,
  includeBots: boolean,
  debug?: boolean,
): Promise<OrgMember[]> {
  const raw = await ghApiList<unknown>(`/orgs/${org}/members`, {
    env: { GH_TOKEN: token },
    debug,
  });

  const members: OrgMember[] = [];
  const errors: string[] = [];

  for (const item of raw) {
    const result = OrgMemberSchema.safeParse(item);
    if (result.success) {
      members.push(result.data);
    } else {
      errors.push(JSON.stringify(item).slice(0, 80));
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Malformed member response — could not parse ${errors.length.toString()} item(s).\n` +
        `First offender: ${errors[0]}`,
    );
  }

  if (includeBots) {
    if (debug) core.info(`[debug] Members fetched: ${members.length.toString()} (bots included)`);
    return members;
  }

  const filtered = members.filter((m) => m.type !== 'Bot');
  if (debug) {
    const botCount = members.length - filtered.length;
    core.info(
      `[debug] Members fetched: ${members.length.toString()} total, ` +
        `${botCount.toString()} bot(s) excluded → ${filtered.length.toString()} human members`,
    );
  }
  return filtered;
}
