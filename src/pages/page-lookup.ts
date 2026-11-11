import type { PageDef } from "./page-def.js";
import { REGISTRY, findPage } from "./registry.js";

export const FIRST_PAGE = 100;
export const LAST_PAGE = 899;

export type LookupResult =
  | { readonly kind: "in-service"; readonly def: PageDef }
  | {
      readonly kind: "not-in-service";
      readonly number: number;
      readonly lower: number;
      readonly higher: number;
    }
  | { readonly kind: "not-a-page-number" };

function isPageRange(n: number): boolean {
  return Number.isInteger(n) && n >= FIRST_PAGE && n <= LAST_PAGE;
}

/** Largest in-service number below `n`, wrapping to 899. `n` must already be an integer from 100 to 899. */
function lowerNeighbour(n: number): number {
  let best = LAST_PAGE;
  let found = false;
  for (const { number } of REGISTRY) {
    if (number < n) {
      best = number;
      found = true;
    }
  }
  return found ? best : LAST_PAGE;
}

/** Smallest in-service number above `n`, wrapping to 100. `n` must already be an integer from 100 to 899. */
function higherNeighbour(n: number): number {
  for (const { number } of REGISTRY) {
    if (number > n) return number;
  }
  return FIRST_PAGE;
}

/** The previous in-service page, wrapping from 100 to 899. `undefined` unless `n` is an integer from 100 to 899. */
export function previousInService(n: number): number | undefined {
  return isPageRange(n) ? lowerNeighbour(n) : undefined;
}

/** The next in-service page, wrapping from 899 to 100. `undefined` unless `n` is an integer from 100 to 899. */
export function nextInService(n: number): number | undefined {
  return isPageRange(n) ? higherNeighbour(n) : undefined;
}

/** Classifies a typed page number (requirement 3.1). Never throws. */
export function lookupPage(input: string): LookupResult {
  if (typeof input !== "string" || !/^[0-9]{3}$/.test(input)) {
    return { kind: "not-a-page-number" };
  }
  const number = Number(input);
  if (!isPageRange(number)) return { kind: "not-a-page-number" };
  const def = findPage(number);
  if (def !== undefined) return { kind: "in-service", def };
  return {
    kind: "not-in-service",
    number,
    lower: lowerNeighbour(number),
    higher: higherNeighbour(number),
  };
}
