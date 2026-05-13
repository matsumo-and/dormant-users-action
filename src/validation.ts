import { z } from 'zod';

const DANGEROUS_PATTERNS: RegExp[] = [
  /created:/i,
  /\bactor:/i,
  /actor_is_bot:/i,
  /[\n\r]/,
  /[;&|`$<>\\'"]/,
];

function isSafePhrase(phrase: string): boolean {
  return !DANGEROUS_PATTERNS.some((re) => re.test(phrase));
}

function parsePhrases(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export const InputSchema = z.object({
  org: z.string().min(1, 'org must be a non-empty string'),

  token: z.string().min(1, 'token must be a non-empty string'),

  days: z.coerce
    .number({ invalid_type_error: 'days must be a number' })
    .int('days must be an integer')
    .min(1, 'days must be at least 1')
    .max(3650, 'days must be at most 3650'),

  includeBots: z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: 'include-bots must be "true" or "false"' }),
    })
    .transform((v) => v === 'true'),

  debug: z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: 'debug must be "true" or "false"' }),
    })
    .transform((v) => v === 'true'),

  phrases: z
    .string()
    .optional()
    .superRefine((raw, ctx) => {
      for (const phrase of parsePhrases(raw)) {
        if (!isSafePhrase(phrase)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Phrase contains reserved or dangerous tokens: "${phrase}"`,
          });
        }
      }
    })
    .transform(parsePhrases),
});

export type ValidatedInputs = z.output<typeof InputSchema>;
export type RawInputs = z.input<typeof InputSchema>;
