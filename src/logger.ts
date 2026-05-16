import * as core from '@actions/core';

let _enabled = false;

/**
 * Configures the debug logger. Must be called once at action startup before
 * any module uses {@link log}.
 */
export function initLogger(debug: boolean): void {
  _enabled = debug;
}

/**
 * Emits a `[debug]`-prefixed info line when debug logging is enabled.
 * A no-op when {@link initLogger} was called with `false` (the default).
 */
export function log(message: string): void {
  if (_enabled) core.info(`[debug] ${message}`);
}
