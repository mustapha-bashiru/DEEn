/**
 * Correlation ids.
 *
 * One id per request, echoed in the response header, included in every error
 * body, and stored on any `audit_logs` row the request produces. That chain is
 * what turns "a user says checkout failed" into a specific server log line.
 *
 * Inbound ids are honoured so a trace started by a client — or by a future
 * gateway — survives into the database, but they are sanitised first: the value
 * lands in log output and in a database column, so an unbounded string with
 * newlines in it is a log-injection vector, not merely untidy.
 */

export const CORRELATION_HEADER = 'x-correlation-id';

/** Long enough to be unique in practice, short enough to read out loud. */
const MAX_LENGTH = 64;

/**
 * Conservative on purpose. Anything outside this set is dropped rather than
 * escaped, because there is no legitimate correlation id that needs it.
 */
const DISALLOWED = /[^A-Za-z0-9_-]/g;

export const sanitizeCorrelationId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(DISALLOWED, '').slice(0, MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
};

export const generateCorrelationId = (): string => globalThis.crypto.randomUUID();

/**
 * Node lower-cases header names and gives an array when a header appears more
 * than once. A repeated correlation header is ambiguous, so the first value wins
 * rather than joining them into something that was never sent.
 */
export const readCorrelationId = (header: string | string[] | undefined): string => {
  const raw = Array.isArray(header) ? header[0] : header;
  return sanitizeCorrelationId(raw) ?? generateCorrelationId();
};
