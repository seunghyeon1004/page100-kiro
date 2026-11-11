import fc from "fast-check";

// Arbitraries for task 12: JSON variations of a recorded fixture (design.md, Property 7).

/** The values a node may be replaced with; the last entry stands for an arbitrary double. */
const REPLACEMENTS: readonly unknown[] = [
  null,
  true,
  "",
  "7",
  0,
  -0,
  -1,
  1e308,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  [],
  {},
];

export type MutationKind = "replace" | "remove-key" | "drop-element" | "duplicate-element";

export interface Mutation {
  /** Picks a node of the current value, modulo the node count. */
  readonly pick: number;
  readonly kind: MutationKind;
  /** Index into `REPLACEMENTS`; the value at its length means `double`. */
  readonly replacement: number;
  readonly double: number;
}

export const mutation: fc.Arbitrary<Mutation> = fc.record({
  pick: fc.nat({ max: 1_000_000 }),
  kind: fc.constantFrom<MutationKind>("replace", "remove-key", "drop-element", "duplicate-element"),
  replacement: fc.nat({ max: REPLACEMENTS.length }),
  double: fc.double({ noNaN: false }),
});

/** One to three mutations. */
export const mutations: fc.Arbitrary<Mutation[]> = fc.array(mutation, {
  minLength: 1,
  maxLength: 3,
});

type Container = Record<string, unknown> | unknown[];

interface Node {
  /** The container holding the node, or `null` for the root. */
  readonly parent: Container | null;
  readonly key: string | number | null;
}

function isContainer(value: unknown): value is Container {
  return typeof value === "object" && value !== null;
}

function collect(root: unknown): Node[] {
  const nodes: Node[] = [{ parent: null, key: null }];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach((child: unknown, i) => {
        nodes.push({ parent: value, key: i });
        walk(child);
      });
    } else if (isContainer(value)) {
      for (const [k, child] of Object.entries(value)) {
        nodes.push({ parent: value, key: k });
        walk(child);
      }
    }
  };
  walk(root);
  return nodes;
}

function replacementOf(m: Mutation): unknown {
  return m.replacement < REPLACEMENTS.length
    ? structuredClone(REPLACEMENTS[m.replacement])
    : m.double;
}

function applyOne(root: unknown, m: Mutation): unknown {
  const nodes = collect(root);
  const node = nodes[m.pick % nodes.length];
  if (node === undefined) return root;
  const { parent, key } = node;
  if (parent === null || key === null) return m.kind === "replace" ? replacementOf(m) : root;
  if (m.kind === "replace") {
    if (Array.isArray(parent) && typeof key === "number") parent[key] = replacementOf(m);
    else if (!Array.isArray(parent) && typeof key === "string") parent[key] = replacementOf(m);
  } else if (m.kind === "remove-key") {
    if (!Array.isArray(parent) && typeof key === "string") Reflect.deleteProperty(parent, key);
  } else if (Array.isArray(parent) && typeof key === "number") {
    if (m.kind === "drop-element") parent.splice(key, 1);
    else parent.splice(key, 0, structuredClone(parent[key]));
  }
  return root;
}

/** A copy of `base` with the mutations applied in order. `base` is never changed. */
export function applyMutations(base: unknown, list: readonly Mutation[]): unknown {
  let value = structuredClone(base);
  for (const m of list) value = applyOne(value, m);
  return value;
}

/** The first place a normalised value holds something JSON cannot carry exactly, or `null`. */
export function findBadValue(value: unknown, path = ""): string | null {
  if (value === undefined) return `${path}: undefined`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return `${path}: NaN`;
    if (!Number.isFinite(value)) return `${path}: Infinity`;
    if (Object.is(value, -0)) return `${path}: -0`;
    return null;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    return `${path}: ${typeof value}`;
  }
  if (Array.isArray(value)) {
    for (const [i, child] of value.entries()) {
      const found = findBadValue(child, `${path}[${String(i)}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, child] of Object.entries(value)) {
      const found = findBadValue(child, `${path}.${k}`);
      if (found !== null) return found;
    }
  }
  return null;
}
