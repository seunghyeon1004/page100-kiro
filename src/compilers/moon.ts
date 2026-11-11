// The moon's phase and the next full and new moon (rule-compilers requirement 6, design.md,
// "Moon"). Jean Meeus, Astronomical Algorithms, 2nd ed., Willmann-Bell, 1998: chapter 48 for the
// illuminated fraction (equations 48.1 and 48.4) and chapter 49 for the times of new and full moon
// (equation 49.1 and the tables that follow it). The difference between dynamical and universal
// time is ignored, as the design says: it is under two minutes in 1970 to 2050.

export type PhaseName =
  | "New moon"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full moon"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

export interface MoonState {
  /** The lit fraction of the disc, 0 to 1. */
  readonly illuminated: number;
  readonly waxing: boolean;
  readonly phase: PhaseName;
  readonly nextFull: Date;
  readonly nextNew: Date;
}

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const FIRST_MS = Date.UTC(1970, 0, 1);
const LAST_MS = Date.UTC(2100, 11, 31, 23, 59, 59, 999);
const RAD = Math.PI / 180;

function sin(degrees: number): number {
  return Math.sin(degrees * RAD);
}

function cos(degrees: number): number {
  return Math.cos(degrees * RAD);
}

function mod360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function julianDay(ms: number): number {
  return ms / MS_PER_DAY + UNIX_EPOCH_JD;
}

/** Phase names by elongation, in 45 degree bands centred on 0, 45, 90 and so on. */
const PHASES: readonly PhaseName[] = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
];

/** The phase name for an elongation in degrees: `New moon` under 22.5 and from 337.5, then every 45. */
export function phaseName(elongation: number): PhaseName {
  const e = mod360(elongation);
  const band = Math.floor((e + 22.5) / 45) % 8;
  return PHASES[band] ?? "New moon";
}

/** Phase angle i (equation 48.4) in degrees, for the instant `ms`. */
function phaseAngle(ms: number): number {
  const t = (julianDay(ms) - 2_451_545) / 36_525;
  const d =
    297.8501921 +
    445_267.1114034 * t -
    0.0018819 * t ** 2 +
    t ** 3 / 545_868 -
    t ** 4 / 113_065_000;
  const m = 357.5291092 + 35_999.0502909 * t - 0.0001536 * t ** 2 + t ** 3 / 24_490_000;
  const mp =
    134.9633964 + 477_198.8675055 * t + 0.0087414 * t ** 2 + t ** 3 / 69_699 - t ** 4 / 14_712_000;
  return (
    180 -
    d -
    6.289 * sin(mp) +
    2.1 * sin(m) -
    1.274 * sin(2 * d - mp) -
    0.658 * sin(2 * d) -
    0.214 * sin(2 * mp) -
    0.11 * sin(d)
  );
}

/** One periodic term: coefficient, power of E, and multiples of M, M', F and the node Omega. */
type Term = readonly [
  coefficient: number,
  e: 0 | 1 | 2,
  m: number,
  mp: number,
  f: number,
  node: number,
];

/** The new moon terms of chapter 49 (the table for the correction to the mean time). */
const NEW_MOON_TERMS: readonly Term[] = [
  [-0.4072, 0, 0, 1, 0, 0],
  [0.17241, 1, 1, 0, 0, 0],
  [0.01608, 0, 0, 2, 0, 0],
  [0.01039, 0, 0, 0, 2, 0],
  [0.00739, 1, -1, 1, 0, 0],
  [-0.00514, 1, 1, 1, 0, 0],
  [0.00208, 2, 2, 0, 0, 0],
  [-0.00111, 0, 0, 1, -2, 0],
  [-0.00057, 0, 0, 1, 2, 0],
  [0.00056, 1, 1, 2, 0, 0],
  [-0.00042, 0, 0, 3, 0, 0],
  [0.00042, 1, 1, 0, 2, 0],
  [0.00038, 1, 1, 0, -2, 0],
  [-0.00024, 1, -1, 2, 0, 0],
  [-0.00017, 0, 0, 0, 0, 1],
  [-0.00007, 0, 2, 1, 0, 0],
  [0.00004, 0, 0, 2, -2, 0],
  [0.00004, 0, 3, 0, 0, 0],
  [0.00003, 0, 1, 1, -2, 0],
  [0.00003, 0, 0, 2, 2, 0],
  [-0.00003, 0, 1, 1, 2, 0],
  [0.00003, 0, -1, 1, 2, 0],
  [-0.00002, 0, -1, 1, -2, 0],
  [-0.00002, 0, 1, 3, 0, 0],
  [0.00002, 0, 0, 4, 0, 0],
];

/** The full moon terms: the same arguments as the new moon, with the first seven coefficients changed. */
const FULL_MOON_TERMS: readonly Term[] = NEW_MOON_TERMS.map((term, i): Term => {
  const [coefficient, ...rest] = term;
  const full = [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209][i];
  return [full ?? coefficient, ...rest];
});

/** Arguments A1 to A14: degrees at k = 0, degrees per k, the coefficient of sin A, degrees per T squared. */
const PLANETARY: readonly (readonly [number, number, number, number])[] = [
  [299.77, 0.107408, 0.000325, -0.009173],
  [251.88, 0.016321, 0.000165, 0],
  [251.83, 26.651886, 0.000164, 0],
  [349.42, 36.412478, 0.000126, 0],
  [84.66, 18.206239, 0.00011, 0],
  [141.74, 53.303771, 0.000062, 0],
  [207.14, 2.453732, 0.00006, 0],
  [154.84, 7.30686, 0.000056, 0],
  [34.52, 27.261239, 0.000047, 0],
  [207.19, 0.121824, 0.000042, 0],
  [291.34, 1.844379, 0.00004, 0],
  [161.72, 24.198154, 0.000037, 0],
  [239.56, 25.513099, 0.000035, 0],
  [331.55, 3.592518, 0.000023, 0],
];

/** Julian Ephemeris Day of the new moon (whole k) or full moon (k + 0.5): equation 49.1 and its corrections. */
function phaseJde(k: number, full: boolean): number {
  const t = k / 1236.85;
  const mean =
    2_451_550.09766 +
    29.530588861 * k +
    0.00015437 * t ** 2 -
    0.00000015 * t ** 3 +
    0.00000000073 * t ** 4;
  const e = 1 - 0.002516 * t - 0.0000074 * t ** 2;
  const m = 2.5534 + 29.1053567 * k - 0.0000014 * t ** 2 - 0.00000011 * t ** 3;
  const mp =
    201.5643 + 385.81693528 * k + 0.0107582 * t ** 2 + 0.00001238 * t ** 3 - 0.000000058 * t ** 4;
  const f =
    160.7108 + 390.67050284 * k - 0.0016118 * t ** 2 - 0.00000227 * t ** 3 + 0.000000011 * t ** 4;
  const node = 124.7746 - 1.56375588 * k + 0.0020672 * t ** 2 + 0.00000215 * t ** 3;

  let correction = 0;
  for (const [coefficient, ePower, tm, tmp, tf, tnode] of full ? FULL_MOON_TERMS : NEW_MOON_TERMS) {
    correction += coefficient * e ** ePower * sin(tm * m + tmp * mp + tf * f + tnode * node);
  }
  let additional = 0;
  for (const [base, perK, coefficient, perT2] of PLANETARY) {
    additional += coefficient * sin(base + perK * k + perT2 * t ** 2);
  }
  return mean + correction + additional;
}

/** The first new or full moon after `ms`, as a Date. */
function nextPhase(ms: number, full: boolean): Date {
  const year = 1970 + (ms - Date.UTC(1970, 0, 1)) / (365.2425 * MS_PER_DAY);
  const approx = (year - 2000) * 12.3685;
  let k = Math.floor(approx) - 1 + (full ? 0.5 : 0);
  const jd = julianDay(ms);
  for (let guard = 0; guard < 6; guard++) {
    const jde = phaseJde(k, full);
    if (jde > jd) return new Date(Math.round((jde - UNIX_EPOCH_JD) * MS_PER_DAY));
    k += 1;
  }
  // Unreachable: the estimate of k is within one lunation, so a phase after `ms` is found at once.
  return new Date(ms + 30 * MS_PER_DAY);
}

/** The state of the moon at `t`, or `undefined` for an invalid time or one outside 1970 to 2100 (UTC). */
export function moonAt(t: Date): MoonState | undefined {
  if (!(t instanceof Date)) return undefined;
  const ms = t.getTime();
  if (!Number.isFinite(ms) || ms < FIRST_MS || ms > LAST_MS) return undefined;
  const i = phaseAngle(ms);
  const elongation = mod360(180 - i);
  return {
    illuminated: Math.min(1, Math.max(0, (1 + cos(i)) / 2)),
    waxing: elongation < 180,
    phase: phaseName(elongation),
    nextFull: nextPhase(ms, true),
    nextNew: nextPhase(ms, false),
  };
}
