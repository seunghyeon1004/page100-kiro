import { describe, expect, it } from "vitest";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { jobFor, AI_PAGES } from "../../src/editor/ai-pages.js";
import { editPage } from "../../src/editor/edit-page.js";
import type { EditorDeps, PageJob } from "../../src/editor/edit-page.js";
import { NOW, SNAPSHOT } from "../compilers/boot-snapshot.js";
import { ScriptedClient, echo, echoRules } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";

// editPage on the boot snapshot with the real draft checks, budget, cache and page checks; only
// the client is scripted (requirements 9.1 to 9.10, 11.2, 11.3).

function job(number: number): PageJob {
  const page = AI_PAGES.find((p) => p.number === number);
  if (page === undefined) throw new Error(`no AI page ${String(number)}`);
  return jobFor(page, SNAPSHOT, NOW);
}

function setup(steps: Step[], caps: [number, number] = [60, 30]) {
  const client = new ScriptedClient(steps);
  const budget = createCallBudget(caps[0], caps[1]);
  const cache = createDraftCache();
  const lines: string[] = [];
  const deps: EditorDeps = { client, budget, cache, log: (line) => lines.push(line) };
  return { client, budget, cache, lines, deps };
}

const BAD_NUMBER: Step = {
  kind: "from",
  make: (request) => ["Floods hit 987654 towns", ...echoRules(request).slice(1)],
};

describe("editPage: accepted drafts", () => {
  it("accepts a good first draft, marks the page ai and counts one call", async () => {
    const { client, deps, budget, lines } = setup([echo]);
    const out = await editPage(job(111), deps, NOW);
    expect(out).toMatchObject({
      editor: "ai",
      reason: "accepted",
      accepted: 1,
      rejected: 0,
      requests: 1,
    });
    expect(out.page?.editor).toBe("ai");
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({ page: 111, attempt: 0, previous: null });
    expect(budget.usage(NOW)).toMatchObject({ callsToday: 1, callsThisBoot: 1 });
    expect(lines).toEqual(["editor p111 a0: accepted"]);
  });

  it("sends the violations and the rejected rows on the retry, then accepts", async () => {
    const { client, deps } = setup([BAD_NUMBER, echo]);
    const out = await editPage(job(111), deps, NOW);
    expect(out).toMatchObject({
      editor: "ai",
      reason: "accepted",
      accepted: 1,
      rejected: 1,
      requests: 2,
    });
    expect(client.calls[1]?.attempt).toBe(1);
    expect(client.calls[1]?.previous).toMatchObject({
      rows: expect.arrayContaining(["Floods hit 987654 towns"]) as string[],
      violations: expect.arrayContaining(['number "987654" not in input']) as string[],
    });
  });

  it("makes at most three drafts, then publishes the rules draft and remembers the key", async () => {
    const { client, deps, cache, lines } = setup([BAD_NUMBER, BAD_NUMBER, BAD_NUMBER, echo]);
    const j = job(111);
    const out = await editPage(j, deps, NOW);
    expect(client.calls).toHaveLength(3);
    expect(client.calls.map((c) => c.attempt)).toEqual([0, 1, 2]);
    expect(out).toMatchObject({ editor: "rules", reason: "rejected", accepted: 0, rejected: 3 });
    expect(out.rows).toEqual(j.rules);
    expect(out.page?.editor).toBe("rules");
    expect(cache.get(j.input)).toEqual({ kind: "rejected" });
    expect(lines.at(-1)).toBe("editor p111 a2: rejected, 1 violations");
  });

  it("makes no call for a remembered rejection (11.3)", async () => {
    const { client, deps } = setup([BAD_NUMBER, BAD_NUMBER, BAD_NUMBER, echo]);
    await editPage(job(111), deps, NOW);
    const again = await editPage(job(111), deps, NOW);
    expect(again).toMatchObject({
      reason: "remembered",
      editor: "rules",
      requests: 0,
      rejected: 0,
    });
    expect(client.calls).toHaveLength(3);
  });

  it("makes no call for an accepted draft already cached, and publishes it again (11.2)", async () => {
    const { client, deps } = setup([echo, echo]);
    await editPage(job(111), deps, NOW);
    const again = await editPage(job(111), deps, NOW);
    expect(again).toMatchObject({ reason: "cached", editor: "ai", accepted: 0, requests: 0 });
    expect(again.page?.editor).toBe("ai");
    expect(client.calls).toHaveLength(1);
  });

  it("drops a cached entry that no longer passes and edits the page as if uncached (11.2)", async () => {
    const { client, deps, cache } = setup([echo]);
    const j = job(111);
    cache.set(j.input, { kind: "accepted", rows: [["a".repeat(99)]] });
    const out = await editPage(j, deps, NOW);
    expect(out).toMatchObject({ reason: "accepted", editor: "ai" });
    expect(client.calls).toHaveLength(1);
  });

  it("turns a publish failure into the violations of the next attempt (9.2)", async () => {
    const { client, deps } = setup([echo, echo]);
    const real = job(111);
    let first = true;
    const flaky: PageJob = {
      ...real,
      publish: (rows, editor) => {
        if (editor === "ai" && first) {
          first = false;
          return {
            ok: false,
            problems: [
              {
                code: "row-width",
                subpage: null,
                row: 7,
                col: 38,
                message: "row 7 is 43 cells, limit 38",
              },
            ],
          };
        }
        return real.publish(rows, editor);
      },
    };
    const out = await editPage(flaky, deps, NOW);
    expect(out).toMatchObject({ reason: "accepted", accepted: 1, rejected: 1 });
    expect(client.calls[1]?.previous?.violations).toEqual(["row 7 is 43 cells, limit 38"]);
  });
});

describe("editPage: client failures", () => {
  it("stops at a refusal, counts it as rejected and remembers the key (9.3)", async () => {
    const { client, deps, cache } = setup([{ kind: "fail", reason: "refusal" }, echo]);
    const j = job(111);
    const out = await editPage(j, deps, NOW);
    expect(out).toMatchObject({
      editor: "rules",
      reason: "refused",
      rejected: 1,
      stopEdition: false,
    });
    expect(client.calls).toHaveLength(1);
    expect(cache.get(j.input)).toEqual({ kind: "rejected" });
  });

  it.each([
    ["max-tokens", "reply stopped at the token limit"],
    ["malformed", "reply was not a JSON object with a rows array"],
  ] as const)("retries after %s with a stated violation (9.4)", async (reason, violation) => {
    const { client, deps } = setup([{ kind: "fail", reason }, echo]);
    const out = await editPage(job(111), deps, NOW);
    expect(out).toMatchObject({ reason: "accepted", rejected: 1, accepted: 1 });
    expect(client.calls[1]?.previous?.violations).toEqual([violation]);
  });

  it.each(["rate-limited", "auth"] as const)(
    "%s stops the page and the edition (9.5)",
    async (reason) => {
      const { client, deps } = setup([{ kind: "fail", reason, status: 429 }, echo]);
      const out = await editPage(job(111), deps, NOW);
      expect(out).toMatchObject({ editor: "rules", reason: "client-failed", stopEdition: true });
      expect(client.calls).toHaveLength(1);
      const later = await editPage(job(112), deps, NOW, true);
      expect(later).toMatchObject({
        reason: "stopped",
        editor: "rules",
        requests: 0,
        stopEdition: true,
      });
      expect(client.calls).toHaveLength(1);
    },
  );

  it.each(["timeout", "connection", "status", "unknown", "no-fixture"] as const)(
    "%s stops the page without remembering the key (9.6)",
    async (reason) => {
      const { client, deps, cache } = setup([{ kind: "fail", reason }, echo]);
      const j = job(111);
      const out = await editPage(j, deps, NOW);
      expect(out).toMatchObject({
        editor: "rules",
        reason: "client-failed",
        stopEdition: false,
        rejected: 0,
      });
      expect(cache.get(j.input)).toBeUndefined();
      expect(client.calls).toHaveLength(1);
    },
  );

  it("treats a throw and a rejected promise as unknown, charged at the reservation (9.6, 9.9)", async () => {
    for (const kind of ["throw", "reject"] as const) {
      const { deps, budget } = setup([{ kind }]);
      const out = await editPage(job(111), deps, NOW);
      expect(out).toMatchObject({ reason: "client-failed", editor: "rules", requests: 2 });
      expect(budget.usage(NOW).callsToday).toBe(2);
    }
  });

  it("settles the budget by the calls the client really made (9.7)", async () => {
    const { deps, budget } = setup([{ kind: "fail", reason: "timeout", requests: 1 }]);
    await editPage(job(111), deps, NOW);
    expect(budget.usage(NOW).callsToday).toBe(1);
  });

  it("charges no more than the reservation when a client reports more", async () => {
    const { deps, budget } = setup([{ kind: "fail", reason: "timeout", requests: 9 }]);
    const out = await editPage(job(111), deps, NOW);
    expect(out.requests).toBe(2);
    expect(budget.usage(NOW).callsToday).toBe(2);
  });
});

describe("editPage: no call", () => {
  it("makes no call when the budget cannot reserve (9.7)", async () => {
    const { client, deps, lines } = setup([echo], [1, 30]); // a draft reserves 2
    const out = await editPage(job(111), deps, NOW);
    expect(out).toMatchObject({ reason: "no-budget", editor: "rules", requests: 0 });
    expect(client.calls).toHaveLength(0);
    expect(lines).toEqual(["editor p111: no budget"]);
  });

  it("stops retrying when the budget runs out between attempts", async () => {
    const { client, deps } = setup([{ ...BAD_NUMBER, requests: 2 }, echo], [3, 30]);
    const out = await editPage(job(111), deps, NOW);
    expect(client.calls).toHaveLength(1);
    expect(out).toMatchObject({ reason: "no-budget", editor: "rules", rejected: 1, requests: 2 });
  });

  it("makes no call for a page without slots (9.10)", async () => {
    const { client, deps } = setup([echo]);
    const out = await editPage(job(118), deps, NOW);
    expect(out).toMatchObject({ reason: "no-slots", editor: "rules", requests: 0 });
    expect(client.calls).toHaveLength(0);
  });

  it("publishes the rules draft as the page, marked rules", async () => {
    const { deps } = setup([]);
    const out = await editPage(job(500), deps, NOW, true);
    expect(out.page?.editor).toBe("rules");
    expect(out.problems).toEqual([]);
  });
});

describe("editPage: the rules draft does not publish", () => {
  it("returns page null and the problems", async () => {
    const { deps } = setup([]);
    const real = job(111);
    const broken: PageJob = {
      ...real,
      publish: () => ({
        ok: false,
        problems: [{ code: "grid", subpage: null, row: null, col: null, message: "stub" }],
      }),
    };
    const out = await editPage(broken, deps, NOW, true);
    expect(out.page).toBeNull();
    expect(out.problems.map((p) => p.message)).toEqual(["stub"]);
  });

  it("never throws, even when publish throws or the log fails", async () => {
    const client = new ScriptedClient([echo]);
    const deps: EditorDeps = {
      client,
      budget: createCallBudget(60, 30),
      cache: createDraftCache(),
      log: () => {
        throw new Error("log sink down");
      },
    };
    const real = job(111);
    const out = await editPage(
      {
        ...real,
        publish: () => {
          throw new Error("boom");
        },
      },
      deps,
      NOW,
    );
    expect(out.page).toBeNull();
    expect(out.editor).toBe("rules");
  });
});
