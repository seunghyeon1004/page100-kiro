import type { NonEmpty } from "../grid/types.js";

/** Where a link in the text alternative goes: a page of this service or an outside address. */
export type LinkTarget = { readonly page: number } | { readonly url: string };

/** One block of a page's text alternative (requirement 4.1). Plain data: no field holds HTML. */
export type AltBlock =
  | { readonly kind: "heading"; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: NonEmpty<string> }
  | {
      readonly kind: "table";
      readonly headers: NonEmpty<string>;
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: "link"; readonly text: string; readonly target: LinkTarget }
  | { readonly kind: "concealed"; readonly summary: string; readonly text: string };
