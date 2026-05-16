import * as core from '@actions/core';

/**
 * Emits a debug log line via `core.debug()`.
 *
 * Output is visible when the `ACTIONS_STEP_DEBUG` secret is set to `true`, or
 * when a workflow run is re-run with "Enable debug logging" checked in the
 * GitHub UI. No custom `debug` input is required.
 */
export function log(message: string): void {
  core.debug(message);
}
