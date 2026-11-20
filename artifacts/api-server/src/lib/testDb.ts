// Test-only fake for `db`. Every query chain resolves to the next scripted
// result set, so route and middleware tests run with no database at all.
export interface FakeDb {
  /** Result sets handed out, in order, to successive awaited queries. */
  queue: unknown[][];
  /** Arguments passed to .where(), so tests can render the SQL actually built. */
  wheres: unknown[];
  /** Arguments passed to .set(). */
  sets: unknown[];
  /** Arguments passed to .values(). */
  inserts: unknown[];
  reset(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Record<string, (...args: any[]) => unknown>;
}

export function createFakeDb(): FakeDb {
  const fake: FakeDb = {
    queue: [],
    wheres: [],
    sets: [],
    inserts: [],
    reset() {
      fake.queue.length = 0;
      fake.wheres.length = 0;
      fake.sets.length = 0;
      fake.inserts.length = 0;
    },
    db: {},
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = (): any =>
    new Proxy(() => {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(fake.queue.shift() ?? []);
        }
        if (prop === "where") {
          return (arg: unknown) => {
            fake.wheres.push(arg);
            return chain();
          };
        }
        if (prop === "set") {
          return (arg: unknown) => {
            fake.sets.push(arg);
            return chain();
          };
        }
        if (prop === "values") {
          return (arg: unknown) => {
            fake.inserts.push(arg);
            return chain();
          };
        }
        return () => chain();
      },
      apply: () => chain(),
    });
  for (const method of ["select", "insert", "update", "delete", "execute"]) {
    fake.db[method] = chain;
  }
  // Run the callback against the same fake so transactional code paths execute.
  fake.db.transaction = async (fn: (tx: unknown) => unknown) => fn(fake.db);
  return fake;
}
