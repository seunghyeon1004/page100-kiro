// Timers as a value, so the scheduler can be run on a fake clock (server-and-viewer 5.8).

export interface Timers {
  /** Runs `fn` once after `ms` milliseconds. Returns an id for `clear`. */
  set(ms: number, fn: () => void): number;
  clear(id: number): void;
}

/** The largest delay `setTimeout` accepts (about 24.8 days). */
const MAX_DELAY_MS = 2_147_483_647;

/** `setTimeout`-backed timers. They are unref'd: the HTTP server keeps the process alive, not a timer. */
export function realTimers(): Timers {
  const handles = new Map<number, NodeJS.Timeout>();
  let next = 1;
  return {
    set(ms, fn) {
      const id = next;
      next += 1;
      const handle = setTimeout(
        () => {
          handles.delete(id);
          fn();
        },
        Math.min(Math.max(ms, 0), MAX_DELAY_MS),
      );
      handle.unref();
      handles.set(id, handle);
      return id;
    },
    clear(id) {
      const handle = handles.get(id);
      if (handle === undefined) return;
      clearTimeout(handle);
      handles.delete(id);
    },
  };
}
