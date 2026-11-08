import { InternalServerErrorException, Logger } from '@nestjs/common';

const logger = new Logger('Supabase');

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

function fail(context: string, detail: string): never {
  logger.error(`${context}: ${detail}`);
  throw new InternalServerErrorException('Database request failed');
}

/**
 * Returns the data of a Supabase query, or throws a generic 500.
 * The real database error (table, column, constraint) is logged on the
 * server only, so it never reaches API clients.
 *
 *   const rows = unwrap(await db.from('price_history').select('*'), 'price history');
 */
export function unwrap<R extends QueryResult>(
  result: R,
  context: string,
): NonNullable<R['data']> {
  if (result.error) {
    fail(context, `${result.error.code ?? 'error'} ${result.error.message}`);
  }
  if (result.data === null || result.data === undefined) {
    fail(context, 'no data returned');
  }
  return result.data;
}

/** Like `unwrap`, for `.maybeSingle()` queries: "no row" is `null`, not an error. */
export function unwrapMaybe<R extends QueryResult>(
  result: R,
  context: string,
): R['data'] {
  if (result.error) {
    fail(context, `${result.error.code ?? 'error'} ${result.error.message}`);
  }
  return result.data;
}

/** For data that must exist (a broken invariant, not a client error). */
export function dataError(context: string, detail: string): never {
  fail(context, detail);
}
