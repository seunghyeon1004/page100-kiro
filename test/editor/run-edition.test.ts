import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import { AI_PAGES } from "../../src/editor/ai-pages.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import type { EditorDeps } from "../../src/editor/edit-page.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS } from "../compilers/boot-snapshot.js";
import { ScriptedClient, echo } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";

// runEdition on the boot snapshot; only the client is scripted (requirements 12.1 to 12.5).

const NUMBERS = AI_PAGES.map((p) => p.number);
const WITH_SLOTS = [110, 111, 112, 113, 114, 115, 500, 501, 700];

function setup(steps: Step[], caps: [number, number] = [60, 60]) {
  const client = new ScriptedClient(steps);
  const lines: string[] = [];
  const deps: EditorDeps = {
    client,
    budget: createCallBudget(caps[0], caps[1]),
    cache: createDraftCache(),
    log: (line) => lines.push(line),
  };
  return { client, deps, lines };
}

const ECHOES: Step[] = Array.from({ length: 12 }, () => echo);

describe("runEdition: the twelve pages (12.1, 12.2)", () => {
  it("gives one outcome per AI page, in order", async () => {
    const { deps } = setup(ECHOES);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(NUMBERS).toEqual([110, 111, 112, 113, 114, 115, 116, 117, 118, 500, 501, 700]);
    expect(result.outcomes.map((o) => o.number)).toEqual(NUMBERS);
    expect(result.pages.map((p) => p.number)).toEqual(NUMBERS);
  });

  it("with a client that always fails, every page equals the page compileAll gives (rules fallback)", async () => {
    const { deps } = setup([]);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    const compiled = compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES);
    for (const page of result.pages) {
      expect(page.editor).toBe("rules");
      expect(page).toEqual(compiled.pages.find((p) => p.number === page.number));
    }
    expect(result.status.fallbackPages).toEqual(NUMBERS);
  });

  it("with a client that echoes the rules draft, every page that has slots is ai and the rest are rules", async () => {
    const { deps, client } = setup(ECHOES);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    for (const page of result.pages) {
      expect(page.editor).toBe(WITH_SLOTS.includes(page.number) ? "ai" : "rules");
    }
    expect(client.calls.map((c) => c.page)).toEqual(WITH_SLOTS);
    expect(result.status.fallbackPages).toEqual([116, 117, 118]);
  });

  it("makes one call at a time and no call for a page without slots", async () => {
    const { deps, client } = setup(ECHOES);
    await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(client.calls).toHaveLength(WITH_SLOTS.length);
  });
});

describe("runEdition: status and log (12.4)", () => {
  it("reports calls, caps, the UTC day and the drafts of the edition", async () => {
    const { deps, lines } = setup(ECHOES, [50, 40]);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(result.status).toEqual({
      day: "2026-11-11",
      callsToday: 9,
      capPerDay: 50,
      callsThisBoot: 9,
      capPerBoot: 40,
      accepted: 9,
      rejected: 0,
      fallbackPages: [116, 117, 118],
    });
    expect(lines.at(-1)).toBe("editor edition: 12 pages, 9 calls, 9 accepted, 0 rejected");
  });

  it("adds to the counts of the same UTC day and resets them on a later one", async () => {
    const first = setup(ECHOES);
    const one = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, first.deps);
    const sameDay = setup(ECHOES);
    const two = await runEdition(
      SNAPSHOT,
      one.status,
      new Date(NOW.getTime() + 3_600_000),
      sameDay.deps,
    );
    expect(two.status).toMatchObject({ day: "2026-11-11", accepted: 18, rejected: 0 });
    const nextDay = setup(ECHOES);
    const three = await runEdition(
      SNAPSHOT,
      two.status,
      new Date("2026-11-12T00:00:01Z"),
      nextDay.deps,
    );
    expect(three.status).toMatchObject({ day: "2026-11-12", accepted: 9, rejected: 0 });
  });

  it("counts rejected drafts", async () => {
    const bad: Step = { kind: "rows", rows: ["x"] };
    const { deps } = setup([bad, bad, bad]);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(result.status.rejected).toBeGreaterThanOrEqual(3);
  });

  it("makes no call for an unchanged input in a second edition (11.1)", async () => {
    const { deps, client } = setup(ECHOES);
    await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    const before = client.calls.length;
    const second = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(client.calls).toHaveLength(before);
    expect(second.outcomes.filter((o) => "reason" in o && o.reason === "cached")).toHaveLength(9);
    expect(second.status.callsToday).toBe(9);
  });

  it("forgets inputs the next edition does not use (11.4)", async () => {
    const { deps, client } = setup([...ECHOES, ...ECHOES]);
    await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    const withoutStories: Snapshot = {
      ...SNAPSHOT,
      sources: {
        ...SNAPSHOT.sources,
        "wikimedia-feed": {
          ...SNAPSHOT.sources["wikimedia-feed"],
          value: { ...SNAPSHOT.sources["wikimedia-feed"].value, news: null },
        },
      },
    };
    await runEdition(withoutStories, emptyEditorStatus(), NOW, deps);
    const before = client.calls.length;
    await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    // The news pages were not used by the middle edition, so they are edited again.
    expect(client.calls.length - before).toBeGreaterThanOrEqual(6);
  });
});

describe("runEdition: stops and failures (12.3, 12.5)", () => {
  it("stops the whole edition after a rate limit: later pages make no call", async () => {
    const { deps, client } = setup([
      { kind: "fail", reason: "rate-limited", status: 429 },
      ...ECHOES,
    ]);
    const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, deps);
    expect(client.calls).toHaveLength(1);
    const reasons = result.outcomes.map((o) => ("reason" in o ? o.reason : o.outcome));
    expect(reasons.slice(0, 2)).toEqual(["client-failed", "stopped"]);
    expect(result.pages).toHaveLength(12);
  });

  it("reports a page whose step throws as failed with codes only, and changes no other page (12.3)", async () => {
    let reads = 0;
    const flaky: Snapshot = {
      ...SNAPSHOT,
      get sources(): Snapshot["sources"] {
        reads += 1;
        // The first read is page 110's; only that page fails.
        if (reads <= 1) throw new Error("secret detail that must not appear");
        return SNAPSHOT.sources;
      },
    };
    const { deps } = setup(ECHOES);
    const result = await runEdition(flaky, emptyEditorStatus(), NOW, deps);
    expect(result.outcomes[0]).toEqual({ number: 110, outcome: "failed", codes: ["threw"] });
    expect(JSON.stringify(result)).not.toContain("secret detail");
    expect(result.pages.map((p) => p.number)).toEqual(NUMBERS.slice(1));
  });

  it("does not throw for a snapshot that throws on every read", async () => {
    const broken: Snapshot = {
      ...SNAPSHOT,
      get sources(): Snapshot["sources"] {
        throw new Error("always");
      },
    };
    const { deps } = setup([]);
    const result = await runEdition(broken, emptyEditorStatus(), NOW, deps);
    expect(result.pages).toEqual([]);
    expect(result.outcomes).toHaveLength(12);
    expect(result.outcomes.every((o) => "outcome" in o && o.codes[0] === "threw")).toBe(true);
  });

  it("does not read the clock: the same inputs give the same result", async () => {
    const a = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, setup(ECHOES).deps);
    const b = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, setup(ECHOES).deps);
    expect(a).toEqual(b);
  });
});
