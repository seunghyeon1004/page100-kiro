import { REGISTRY } from "../../src/pages/registry.js";
import { compileBootPages } from "./boot-pages.js";

/** Every in-service page: number, title, editor and subpage count (`?` when it does not compile). */
export function listPages(): string {
  const { result } = compileBootPages();
  const lines = REGISTRY.map((def) => {
    const compiled = result.pages.find((p) => p.number === def.number);
    const count = compiled === undefined ? "?" : String(compiled.subpages.length);
    return `${String(def.number)}  ${def.title.padEnd(24)}  ${def.editor.padEnd(6)}  ${count}`;
  });
  return [`number  ${"title".padEnd(24)}  ${"editor".padEnd(6)}  subpages`, ...lines].join("\n");
}
