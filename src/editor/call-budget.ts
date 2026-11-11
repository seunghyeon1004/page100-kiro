// The call budget (ai-editor requirement 10): at most `capPerDay` calls per UTC day and at most
// `capPerBoot` calls since creation. In memory only: a restart of the server resets both counts, so
// `capPerBoot` bounds what any one start can spend.

export interface BudgetUsage {
  /** `YYYY-MM-DD` of the day the daily count belongs to, in UTC; `null` before the first use. */
  readonly day: string | null;
  readonly callsToday: number;
  readonly capPerDay: number;
  readonly callsThisBoot: number;
  readonly capPerBoot: number;
}

export interface CallBudget {
  /** Counts `n` calls when both caps allow them, and says whether it did. Never throws. */
  tryReserve(n: number, now: Date): boolean;
  /** Gives back the calls that a reservation of `reserved` did not use. Never throws. */
  settle(reserved: number, used: number): void;
  usage(now: Date): BudgetUsage;
}

/** The UTC day of a time, or `null` for an invalid Date. */
function dayOf(now: Date): string | null {
  const ms = now.getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

export function createCallBudget(capPerDay: number, capPerBoot: number): CallBudget {
  let day: string | null = null;
  let today = 0;
  let boot = 0;

  /** Moves to a later day and resets the daily count; an earlier or invalid time changes nothing. */
  function roll(now: Date): void {
    const current = dayOf(now);
    if (current === null) return;
    if (day === null || current > day) {
      day = current;
      today = 0;
    }
  }

  return {
    tryReserve(n, now) {
      if (!Number.isInteger(n) || n < 0 || dayOf(now) === null) return false;
      roll(now);
      if (today + n > capPerDay || boot + n > capPerBoot) return false;
      today += n;
      boot += n;
      return true;
    },
    settle(reserved, used) {
      const spent = Math.min(Math.max(Number.isInteger(used) ? used : reserved, 0), reserved);
      const back = reserved - spent;
      today = Math.max(today - back, 0);
      boot = Math.max(boot - back, 0);
    },
    usage(now) {
      roll(now);
      return { day, callsToday: today, capPerDay, callsThisBoot: boot, capPerBoot };
    },
  };
}
