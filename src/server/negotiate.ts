// Content negotiation (server-and-viewer 8.4, 8.5, 7.5): the encoding to send, `If-None-Match`,
// and the terminal agents that get ANSI text.

export type Encoding = "br" | "gzip" | "identity";

/** `0`, `0.5`, `1`, `1.000`: a q between 0 and 1 with up to three decimals. */
const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/** The q-value of each coding the header names, by lower-case token. A malformed item is ignored. */
function parseAcceptEncoding(header: string): Map<string, number> {
  const qs = new Map<string, number>();
  for (const item of header.split(",")) {
    const [rawToken = "", ...params] = item.split(";");
    const token = rawToken.trim().toLowerCase();
    if (token === "" || !/^[a-z0-9*._-]+$/.test(token)) continue;
    let q = 1;
    let bad = false;
    for (const param of params) {
      const match = /^\s*q\s*=\s*(\S+)\s*$/i.exec(param);
      if (match === null) {
        bad = true;
        break;
      }
      const text = match[1] ?? "";
      if (!QVALUE.test(text)) {
        bad = true;
        break;
      }
      q = Number(text);
    }
    if (!bad && !qs.has(token)) qs.set(token, q);
  }
  return qs;
}

/** `br` when its q (or the wildcard's) is above 0, else `gzip` likewise, else `identity`. */
export function chooseEncoding(header: string | undefined): Encoding {
  if (header === undefined) return "identity";
  const qs = parseAcceptEncoding(header);
  const wildcard = qs.get("*");
  const acceptable = (token: string): boolean => (qs.get(token) ?? wildcard ?? 0) > 0;
  if (acceptable("br")) return "br";
  if (acceptable("gzip")) return "gzip";
  return "identity";
}

/** True when the header matches `tag` (a quoted ETag): `*`, or any listed tag, weak or strong. */
export function ifNoneMatch(header: string | undefined, tag: string): boolean {
  if (header === undefined) return false;
  return header.split(",").some((item) => {
    const candidate = item.trim().replace(/^W\//, "");
    return candidate === "*" || candidate === tag;
  });
}

/** True when the User-Agent starts with `curl/` or `Wget/` (frontend.md). */
export function isTerminalAgent(userAgent: string | undefined): boolean {
  return (
    userAgent !== undefined && (userAgent.startsWith("curl/") || userAgent.startsWith("Wget/"))
  );
}
