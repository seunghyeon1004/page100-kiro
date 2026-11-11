import { z } from "zod";

/** A finite number that is not -0. Normalised schemas use it for every number (design.md, "Normalised types"). */
export const NormalNumber = z.number().refine((n) => !Object.is(n, -0), {
  message: "negative zero",
});

/** `-0` becomes `0`. Any other number is returned as it is. */
export function cleanNumber(n: number): number {
  return Object.is(n, -0) ? 0 : n;
}
