import { execa } from 'execa';

export type GhApiListOptions = {
  env?: Record<string, string>;
  fields?: Record<string, string>;
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

export async function checkGhCli(): Promise<void> {
  try {
    await execa('gh', ['--version']);
  } catch {
    throw new Error(
      'GitHub CLI (gh) is not installed or not in PATH. ' +
        'GitHub-hosted runners include gh by default; ' +
        'for self-hosted runners install it from https://cli.github.com.',
    );
  }
}

export async function verifyToken(token: string): Promise<void> {
  try {
    await execa('gh', ['api', '/user'], {
      env: { ...process.env, GH_TOKEN: token },
    });
  } catch (err: unknown) {
    const e = err as { stderr?: string; exitCode?: number };
    throw new GhApiError('/user', e.stderr ?? '', e.exitCode ?? -1);
  }
}

export async function ghApiList<T>(endpoint: string, options: GhApiListOptions = {}): Promise<T[]> {
  const { env = {}, fields = {} } = options;

  const args: string[] = ['api', endpoint, '--paginate', '--jq', '.[]'];
  for (const [key, value] of Object.entries(fields)) {
    args.push('-f', `${key}=${value}`);
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

  return parseNdJson<T>(stdout);
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
