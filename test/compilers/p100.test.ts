import { describe, expect, it } from "vitest";
import { compile100 } from "../../src/compilers/p100-index.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { markupOf, pageOf, pageProblems, screenText } from "./boot-snapshot.js";

describe("page 100 (requirement 9.1)", () => {
  const result = compile100();

  it("lays out the index exactly", () => {
    expect(markupOf(result)).toMatchInlineSnapshot(`
      "
              {y}🬚🬋🬏🬖🬋🬏🬖🬋🬏🬚🬋🬃   🬞🬓 🬖🬋🬏🬖🬋🬏
              {y}🬛🬋🬀🬛🬋▌▌🬋🬓🬛🬋     ▌ 🬲🬅▌🬲🬅▌
              {y}🬄  🬄 🬄🬈🬋🬀🬌🬋🬃   🬇🬌 🬈🬋🬀🬈🬋🬀

       {y}110{w} World news      {y}550{w} Quiz
       {y}120{w} Most read       {y}600{w} Earthquakes
       {y}200{w} Weather now     {y}601{w} The moon
       {y}201{w} Outlook         {y}610{w} Launches
       {y}300{w} Exchange rates  {y}700{w} Article
       {y}301{w} Rate trend      {y}800{w} Help
       {y}400{w} Developer news  {y}801{w} About
       {y}500{w} On this day     {y}802{w} Status
       {y}501{w} Born and died   {y}899{w} Test page

       Type a page number, or use the
       coloured links below.
      "
    `);
  });

  it("is sound, has dataAt null and the registry's editor", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({ number: 100, dataAt: null, editor: "rules" });
    expect(result.ok && result.outcome).toBe("compiled");
  });

  it("has one alt link per section, to a page in the registry, and the two paragraphs", () => {
    const alt = pageOf(result).subpages[0].alt;
    const links = alt.flatMap((b) => (b.kind === "link" ? [b] : []));
    expect(links).toHaveLength(18);
    const pages = links.map((l) => ("page" in l.target ? l.target.page : -1));
    for (const page of pages) expect(REGISTRY.some((d) => d.number === page)).toBe(true);
    expect(alt[0]).toEqual({ kind: "paragraph", text: "Page 100" });
    expect(alt.at(-1)).toEqual({
      kind: "paragraph",
      text: "Type a page number, or use the coloured links below.",
    });
    expect(links[0]).toEqual({ kind: "link", text: "110 World news", target: { page: 110 } });
  });

  it("shows the screen", () => {
    expect(screenText(result)).toMatchInlineSnapshot(`
      "P100 Page 100        Wed 11 Nov 14:05:09
      INDEX                                   
                                              
              🬚🬋🬏🬖🬋🬏🬖🬋🬏🬚🬋🬃   🬞🬓 🬖🬋🬏🬖🬋🬏        
              🬛🬋🬀🬛🬋▌▌🬋🬓🬛🬋     ▌ 🬲🬅▌🬲🬅▌        
              🬄  🬄 🬄🬈🬋🬀🬌🬋🬃   🬇🬌 🬈🬋🬀🬈🬋🬀        
                                              
       110 World news      550 Quiz           
       120 Most read       600 Earthquakes    
       200 Weather now     601 The moon       
       201 Outlook         610 Launches       
       300 Exchange rates  700 Article        
       301 Rate trend      800 Help           
       400 Developer news  801 About          
       500 On this day     802 Status         
       501 Born and died   899 Test page      
                                              
       Type a page number, or use the         
       coloured links below.                  
                                              
                                              
                                              
                                              
       News      Weather   Rates     Help     "
    `);
  });
});
