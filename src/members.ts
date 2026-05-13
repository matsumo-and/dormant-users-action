import { z } from 'zod';
import { ghApiList } from './github.js';

export const OrgMemberSchema = z.object({
  login: z.string(),
  id: z.number(),
  type: z.string().default('User'),
});

export type OrgMember = z.infer<typeof OrgMemberSchema>;

export async function fetchOrgMembers(
  org: string,
  token: string,
  includeBots: boolean,
): Promise<OrgMember[]> {
  const raw = await ghApiList<unknown>(`/orgs/${org}/members`, {
    env: { GH_TOKEN: token },
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

  if (includeBots) return members;
  return members.filter((m) => m.type !== 'Bot');
}
