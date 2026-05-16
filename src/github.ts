import { execa } from 'execa';
import { log } from './logger.js';

/** Options for {@link ghApiList}. */
export type GhApiListOptions = {
  /** Additional environment variables forwarded to the `gh` process. */
  env?: Record<string, string>;
};

/**
 * Thrown when a `gh api` invocation exits with a non-zero status.
 * The message is human-readable and tailored to common HTTP error codes.
 */
export class GhApiError extends Error {
  constructor(
    /** The API endpoint path that failed. */
    public readonly endpoint: string,
    /** Raw stderr output from the `gh` process. */
    public readonly stderr: string,
    /** Process exit code returned by `gh`. */
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

/**
 * Verifies that the GitHub CLI (`gh`) is installed and reachable in `PATH`.
 * @throws {Error} If `gh` is not found or exits with a non-zero status.
 */
export async function checkGhCli(): Promise<void> {
  try {
    const result = await execa('gh', ['--version']);
    log(`gh CLI found: ${result.stdout.split('\n')[0]}`);
  } catch {
    throw new Error(
      'GitHub CLI (gh) is not installed or not in PATH. ' +
        'GitHub-hosted runners include gh by default; ' +
        'for self-hosted runners install it from https://cli.github.com.',
    );
  }
}

/**
 * Confirms that `token` is accepted by the GitHub API via `GET /rate_limit`.
 *
 * Uses `/rate_limit` rather than `/user` because the latter returns 403 for
 * GitHub App installation tokens.
 *
 * @throws {GhApiError} If the token is invalid or the request fails.
 */
export async function verifyToken(token: string): Promise<void> {
  // /rate_limit works for PATs, OAuth tokens, and GitHub App installation
  // tokens alike. /user returns 403 for App tokens so cannot be used here.
  try {
    const result = await execa('gh', ['api', '/rate_limit'], {
      env: { ...process.env, GH_TOKEN: token },
    });
    try {
      const data = JSON.parse(result.stdout) as {
        rate?: { remaining: number; limit: number; reset: number };
      };
      const rate = data.rate;
      if (rate) {
        const resetAt = new Date(rate.reset * 1000).toISOString();
        log(
          `Token verified — rate limit: ${rate.remaining.toString()}/${rate.limit.toString()} remaining, resets at ${resetAt}`,
        );
      } else {
        log('Token verified successfully');
      }
    } catch {
      log('Token verified successfully');
    }
  } catch (err: unknown) {
    const e = err as { stderr?: string; exitCode?: number };
    throw new GhApiError('/rate_limit', e.stderr ?? '', e.exitCode ?? -1);
  }
}

/**
 * Calls `gh api <endpoint> --paginate --jq '.[]'` and returns all items as a
 * typed array. Each NDJSON line emitted by `--paginate` is parsed individually.
 *
 * @template T - Expected shape of each item in the response array.
 * @param endpoint - GitHub REST API path (e.g. `/orgs/my-org/members`).
 * @throws {GhApiError} If `gh` exits with a non-zero status.
 * @throws {Error} If any NDJSON line cannot be parsed as JSON.
 */
export async function ghApiList<T>(endpoint: string, options: GhApiListOptions = {}): Promise<T[]> {
  const { env = {} } = options;

  const args: string[] = ['api', endpoint, '--paginate', '--jq', '.[]'];

  log(`gh api ${endpoint} --paginate`);

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
  log(`${endpoint} → ${items.length.toString()} items`);
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
