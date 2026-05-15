import * as core from '@actions/core';
import { InputSchema, ValidatedInputs } from './validation.js';

/**
 * Reads all `@actions/core` inputs, validates them through {@link InputSchema},
 * and returns the typed result.
 *
 * @throws {Error} If any input fails validation, with a formatted list of issues.
 */
export function getInputs(): ValidatedInputs {
  const raw = {
    org: core.getInput('org', { required: true }),
    token: core.getInput('token', { required: true }),
    days: core.getInput('days') || '90',
    includeBots: (core.getInput('include-bots') || 'false') as 'true' | 'false',
    debug: (core.getInput('debug') || 'false') as 'true' | 'false',
    phrases: core.getInput('phrases') || undefined,
  };

  const result = InputSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `  • ${issue.message}`).join('\n');
    throw new Error(`Invalid action inputs:\n${errors}`);
  }

  return result.data;
}
