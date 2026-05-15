import * as core from '@actions/core';
import { execa } from 'execa';

export type GhApiListOptions = {
  env?: Record<string, string>;
  debug?: boolean;
};

export class GhApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly stderr: string,
    public readonly exitCode: number,
  ) {
    super(GhApiError.describe(endpoint, stderr, exitCode));
    this.name = 'GhApiError';
  }

  private static describe(endpoint: string, stderr: string, exitCode: number): string {
    const lower = stderr.toLowerCase();
    if (lower.includes('bad credentials') || exitCode === 401) {
      return `Authentication failed for ${endpoint}. Check that your token is valid and not expired.`;
    }
    if (exitCode === 403 || lower.includes('forbidden')) {
      return (
        `Access forbidden for ${endpoint}. ` +
        `Ensure the token has read:org and read:audit_log scopes and that ` +
        `your organization is on a plan that supports the Audit Log API (Enterprise Cloud or Team).`
      );
    }
    if (exitCode === 404 || lower.includes('not found')) {
      return `Resource not found: ${endpoint}. Verify the organization name is correct.`;
    }
    if (exitCode === 429 || lower.includes('rate limit')) {
      return `GitHub API rate limit exceeded. Wait for the limit to reset before retrying.`;
    }
    return `gh api ${endpoint} failed (exit ${exitCode.toString()}): ${stderr}`;
  }
}

export async function checkGhCli(debug?: boolean): Promise<void> {
  try {
    const result = await execa('gh', ['--version']);
    if (debug) {
      core.info(`[debug] gh CLI found: ${result.stdout.split('\n')[0]}`);
    }
  } catch {
    throw new Error(
      'GitHub CLI (gh) is not installed or not in PATH. ' +
        'GitHub-hosted runners include gh by default; ' +
        'for self-hosted runners install it from https://cli.github.com.',
    );
  }
}

export async function verifyToken(token: string, debug?: boolean): Promise<void> {
  // /rate_limit works for PATs, OAuth tokens, and GitHub App installation
  // tokens alike. /user returns 403 for App tokens so cannot be used here.
  try {
    const result = await execa('gh', ['api', '/rate_limit'], {
      env: { ...process.env, GH_TOKEN: token },
    });
    if (debug) {
      try {
        const data = JSON.parse(result.stdout) as {
          rate?: { remaining: number; limit: number; reset: number };
        };
        const rate = data.rate;
        if (rate) {
          const resetAt = new Date(rate.reset * 1000).toISOString();
          core.info(
            `[debug] Token verified — rate limit: ${rate.remaining.toString()}/${rate.limit.toString()} remaining, resets at ${resetAt}`,
          );
        } else {
          core.info('[debug] Token verified successfully');
        }
      } catch {
        core.info('[debug] Token verified successfully');
      }
    }
  } catch (err: unknown) {
    const e = err as { stderr?: string; exitCode?: number };
    throw new GhApiError('/rate_limit', e.stderr ?? '', e.exitCode ?? -1);
  }
}

export async function ghApiList<T>(endpoint: string, options: GhApiListOptions = {}): Promise<T[]> {
  const { env = {}, debug } = options;

  const args: string[] = ['api', endpoint, '--paginate', '--jq', '.[]'];

  if (debug) {
    core.info(`[debug] gh api ${endpoint} --paginate`);
  }

  let stdout: string;
  try {
    const result = await execa('gh', args, {
      env: { ...process.env, ...env },
      maxBuffer: 100 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err: unknown) {
    const e = err as { stderr?: string; exitCode?: number; message?: string };
    throw new GhApiError(endpoint, e.stderr ?? e.message ?? '', e.exitCode ?? -1);
  }

  const items = parseNdJson<T>(stdout);
  if (debug) {
    core.info(`[debug] ${endpoint} → ${items.length.toString()} items`);
  }
  return items;
}

function parseNdJson<T>(raw: string): T[] {
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        throw new Error(
          `Failed to parse audit log line ${(index + 1).toString()}: ${line.slice(0, 120)}`,
        );
      }
    });
}
