import * as core from '@actions/core';
import { getInputs } from './inputs.js';
import { checkGhCli, verifyToken } from './github.js';
import { fetchOrgMembers } from './members.js';
import { buildAuditLogQuery, getCutoffDate, fetchActiveActors } from './auditlog.js';
import { setOutputs } from './outputs.js';

async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const { org, token, days, phrases, includeBots } = inputs;

    await checkGhCli();
    await verifyToken(token);

    const cutoff = getCutoffDate(days);
    const query = buildAuditLogQuery(cutoff, phrases);

    if (core.isDebug()) {
      core.startGroup('dormant-users-action: configuration');
      core.info(`Organization   : ${org}`);
      core.info(`Days look-back : ${days.toString()}`);
      core.info(`Cutoff date    : ${cutoff.toISOString().split('T')[0]}`);
      core.info(`Include bots   : ${includeBots.toString()}`);
      core.info(
        `Phrases        : ${phrases.length > 0 ? phrases.join(', ') : '(none — all events)'}`,
      );
      core.info(`Audit log query: ${query}`);
      core.endGroup();
    }

    core.info(`[1/3] Fetching organization members for ${org}...`);
    const members = await fetchOrgMembers(org, token, includeBots);

    core.info('[2/3] Fetching audit log activity (this may take a moment for large orgs)...');
    const activeActors = await fetchActiveActors(org, token, query);

    const dormantUsers = members.filter(({ login }) => !activeActors.has(login));

    if (core.isDebug()) {
      core.startGroup('dormant-users-action: dormant users');
      core.info(`Active members : ${(members.length - dormantUsers.length).toString()}`);
      core.info(`Dormant members: ${dormantUsers.length.toString()}`);
      if (dormantUsers.length > 0) {
        core.info(`Dormant logins : ${dormantUsers.map((u) => u.login).join(', ')}`);
      }
      core.endGroup();
    }

    core.info(
      `[3/3] Done — ${dormantUsers.length.toString()} dormant / ` +
        `${members.length.toString()} total members.`,
    );

    setOutputs(dormantUsers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.setFailed(message);
  }
}

void run();
