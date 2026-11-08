/**
 * In-memory stand-in for the Supabase query builder, for unit tests.
 * Supports the calls this API uses: select, eq, in, gte, lte, order, limit,
 * maybeSingle, single, upsert. Filters, ordering and limits are applied to
 * the given rows, so tests check real query logic, not just call sequences.
 * `select(columns)` returns whole rows (column lists are not projected).
 */
type Row = Record<string, unknown>;

export interface FakeDb {
  client: unknown;
  /** Rows passed to upsert, per table. */
  upserts: Record<string, Row[]>;
}

export function fakeSupabase(
  tables: Record<string, Row[]>,
  opts: { failOn?: string } = {},
): FakeDb {
  const upserts: Record<string, Row[]> = {};

  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let mode: 'many' | 'single' | 'maybe' = 'many';
    let upserted: Row | null = null;

    const result = () => {
      if (opts.failOn === table) {
        return {
          data: null,
          error: { code: 'XX000', message: `fake failure on ${table}` },
        };
      }
      const out = upserted ? [upserted] : rows;
      if (mode === 'many') return { data: out, error: null };
      if (out.length > 1) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'multiple rows' },
        };
      }
      if (out.length === 0 && mode === 'single') {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      }
      return { data: out[0] ?? null, error: null };
    };

    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => (
        (rows = rows.filter((r) => r[col] === v)),
        builder
      ),
      in: (col: string, vs: unknown[]) => (
        (rows = rows.filter((r) => vs.includes(r[col]))),
        builder
      ),
      gte: (col: string, v: string) => (
        (rows = rows.filter((r) => String(r[col]) >= v)),
        builder
      ),
      lte: (col: string, v: string) => (
        (rows = rows.filter((r) => String(r[col]) <= v)),
        builder
      ),
      order: (col: string, o: { ascending: boolean }) => {
        rows.sort((a, b) => {
          const c = String(a[col]).localeCompare(String(b[col]));
          return o.ascending ? c : -c;
        });
        return builder;
      },
      limit: (n: number) => ((rows = rows.slice(0, n)), builder),
      maybeSingle: () => ((mode = 'maybe'), builder),
      single: () => ((mode = 'single'), builder),
      upsert: (row: Row) => {
        (upserts[table] ??= []).push(row);
        upserted = { ...row, stored: true };
        return builder;
      },
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  };

  return { client: { from }, upserts };
}
