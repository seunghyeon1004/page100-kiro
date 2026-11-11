import { describe, expect, it } from "vitest";
import {
  chooseQuestions,
  compile550,
  numberTokens,
  quizSeed,
} from "../../src/compilers/p550-quiz.js";
import {
  NOW,
  SNAPSHOT,
  markupOf,
  pageOf,
  pageProblems,
  plainOf,
  screenText,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["wikimedia-onthisday"];

function withEvents(events: { year: number; text: string }[]) {
  return { ...ENTRY, value: { ...ENTRY.value, events } };
}

describe("page 550 (requirement 14.3)", () => {
  const result = compile550(ENTRY, NOW);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 550,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("asks five questions with their years concealed", () => {
    const markup = markupOf(result);
    expect(markup.split("\n").filter((r) => r.includes("{?}"))).toHaveLength(5);
    expect(plainOf(markup)).toContain("Press Reveal to show the answers.");
    expect(plainOf(markup).split("\n")[0]).toBe(" In which year did each of these happen?");
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P550 Page 100        Wed 11 Nov 14:05:09
      QUIZ OF THE DAY                         
       In which year did each of these happen?
                                              
       1 NASA launches Gemini 12.             
         Year: 1966                           
                                              
       2 The House of Lords Act is given Royal
         Assent, restricting membership of... 
         Year: 1999                           
       3 Russo-Ukrainian War: Ukrainian armed 
         forces enter the city of Kherson...  
         Year: 2022                           
       4 A strong earthquake with the         
         magnitude 6.8 hits northern Burma... 
         Year: 2012                           
       5 World War II: France's zone libre is 
         occupied by German forces in Case... 
         Year: 1942                           
                                              
       Press Reveal to show the answers.      
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     Events    Births    Quakes   "
    `);
  });

  it("gives, per question, a paragraph and a concealed block", () => {
    const alt = pageOf(result).subpages[0].alt;
    expect(alt.map((b) => b.kind)).toEqual([
      "paragraph",
      "paragraph",
      "concealed",
      "paragraph",
      "concealed",
      "paragraph",
      "concealed",
      "paragraph",
      "concealed",
      "paragraph",
      "concealed",
      "paragraph",
    ]);
    const question = alt[1];
    const answer = alt[2];
    expect(question?.kind === "paragraph" && question.text.startsWith("Question 1: ")).toBe(true);
    expect(answer?.kind === "concealed" && answer.summary).toBe("Show answer");
    expect(answer?.kind === "concealed" && /^Year: \d+( BC)?$/.test(answer.text)).toBe(true);
  });

  it("is the same for the same UTC day and changes with the day", () => {
    const sameDay = compile550(ENTRY, new Date("2026-11-11T23:59:59Z"));
    expect(markupOf(sameDay)).toBe(markupOf(result));
    const years = (d: Date) => chooseQuestions(ENTRY, d).map((q) => q.year);
    expect(quizSeed(NOW)).toBe(20261111);
    expect(years(new Date("2026-11-12T00:00:00Z"))).not.toEqual(years(NOW));
  });
});

describe("page 550: eligibility and counts", () => {
  const event = (year: number, text: string) => ({ year, text });

  it("gives the no-data page for zero eligible events", () => {
    for (const events of [
      [],
      [event(5, "Too early a year to ask about.")],
      [event(1066, "The 1066 invasion happens.")],
      [event(1900, "Bad \u2603 text")],
      [event(1900, "a".repeat(80))],
    ]) {
      const out = compile550(withEvents(events), NOW);
      expect(out.ok && out.outcome).toBe("no-data");
      expect(pageProblems(out)).toEqual([]);
    }
  });

  it("asks as many questions as there are eligible events, up to five", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 9]) {
      const events = Array.from({ length: count }, (_, i) =>
        event(1000 + i * 7, `Event number ${String(i)} happens.`),
      );
      const out = compile550(withEvents(events), NOW);
      expect(pageProblems(out), String(count)).toEqual([]);
      expect(
        markupOf(out)
          .split("\n")
          .filter((r) => r.includes("{?}")),
      ).toHaveLength(Math.min(count, 5));
    }
  });

  it("skips a question whose year appears as a number in an already chosen text, and the reverse", () => {
    const events = [
      event(1914, "War breaks out in 1939 elsewhere."),
      event(1939, "Another thing."),
      event(1800, "A calm event."),
    ];
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const chosen = chooseQuestions(withEvents(events), new Date(Date.UTC(2026, 10, day)));
      const years = chosen.map((q) => q.year);
      expect(years.includes(1914) && years.includes(1939)).toBe(false);
    }
  });

  it("writes BC years concealed with BC", () => {
    const out = compile550(withEvents([event(-44, "Caesar is killed in Rome.")]), NOW);
    expect(markupOf(out)).toContain("{y}{?}44 BC");
  });

  it("finds number tokens with commas and points removed", () => {
    expect(numberTokens("In 1,066 and 3.5 and 12 AD")).toEqual(["1066", "35", "12"]);
  });
});
