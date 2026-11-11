import fc from "fast-check";

// Arbitraries for the server properties (server-and-viewer design.md, "Correctness properties").
// Everything here is hostile on purpose: the renderers and the router must cope with it.

/** Pieces that break HTML, attributes and entities if they are ever written raw. */
const HOSTILE_PIECES: readonly string[] = [
  "<",
  ">",
  "&",
  '"',
  "'",
  "{",
  "}",
  "</section>",
  "&amp;",
  "<script>",
  "&lt;b&gt;",
  "a",
  "b",
  " ",
  "1",
  "é",
  "£",
];

/** A string of repertoire characters and the hostile pieces, 1 to 24 pieces. */
export const hostileText: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...HOSTILE_PIECES), { minLength: 1, maxLength: 24 })
  .map((pieces) => pieces.join(""));

/** URLs for alt links: some safe, some not. */
export const hostileUrl: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    'https://x/"><b>',
    "https://example.org/a?b=c&d=e",
    "http://example.org/plain",
    "ftp://example.org/",
    "https://example.org/<script>",
    "not a url",
    "",
    "//example.org/",
    "https://example.org/'quoted'",
  ),
  hostileText.map((text) => `https://example.org/${text}`),
);

export const requestMethod: fc.Arbitrary<string> = fc.oneof(
  { weight: 6, arbitrary: fc.constantFrom("GET", "HEAD") },
  {
    weight: 4,
    arbitrary: fc.constantFrom(
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
      "TRACE",
      "CONNECT",
      "get",
      "",
    ),
  },
);

const PAGE_PATHS: readonly string[] = [
  "/",
  "/100",
  "/201",
  "/550",
  "/123",
  "/999",
  "/100.txt",
  "/201.ansi",
  "/300.json",
  "/200.frag",
  "/go",
  "/api/health",
  "/api/status",
  "/robots.txt",
  "/favicon.svg",
  "/assets/",
  "/assets/app.css",
  "/%31%30%30",
  "/100/",
  "//100",
  "/../100",
  "/100.html",
  "/ABC",
];

/** Raw request paths: known routes, odd ones, and arbitrary text up to 3,000 characters. */
export const rawPath: fc.Arbitrary<string> = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(...PAGE_PATHS) },
  { weight: 3, arbitrary: fc.string({ minLength: 0, maxLength: 60 }).map((s) => `/${s}`) },
  { weight: 1, arbitrary: fc.string({ minLength: 1000, maxLength: 3000 }).map((s) => `/${s}`) },
  { weight: 1, arbitrary: fc.constantFrom("", "*", "%", "/%", "/\u0000", "/100\u0000") },
);

const QUERIES: readonly string[] = [
  "",
  "?",
  "?s=1",
  "?s=2",
  "?s=0",
  "?s=7",
  "?s=10",
  "?s=%31",
  "?s=1&s=2",
  "?reveal=1",
  "?reveal=0",
  "?s=1&reveal=1",
  "?p=300",
  "?p=30",
  "?p=abc",
  "?p=300&p=400",
  "?p=%33%30%30",
];

export const rawQuery: fc.Arbitrary<string> = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(...QUERIES) },
  { weight: 2, arbitrary: fc.string({ minLength: 0, maxLength: 40 }).map((s) => `?${s}`) },
);

/** The raw `url` of a request: path then query. */
export const rawUrl: fc.Arbitrary<string> = fc
  .tuple(rawPath, rawQuery)
  .map(([path, query]) => `${path}${query}`);

export const userAgentHeader: fc.Arbitrary<string | undefined> = fc.constantFrom(
  undefined,
  "curl/8.4.0",
  "Wget/1.21",
  "Mozilla/5.0",
  "curl",
  "",
);

export const acceptEncodingHeader: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constantFrom(
    undefined,
    "",
    "br",
    "gzip",
    "br, gzip",
    "gzip, br",
    "identity",
    "*",
    "br;q=0",
    "gzip;q=0, br;q=0",
    "br;q=0.5, gzip;q=1",
    "*;q=0",
    "br;q=abc",
    "gzip;q=1.5",
    "BR",
    ", ,",
    "br;q=0.001",
  ),
  fc.string({ maxLength: 40 }),
);

export const ifNoneMatchHeader: fc.Arbitrary<string | undefined> = fc.constantFrom(
  undefined,
  "",
  "*",
  '"x"',
  'W/"x"',
  '"a", "b"',
  "garbage",
);

export type RequestHeaders = Readonly<Record<string, string | undefined>>;

/** Request headers the router reads, with hostile or missing values. */
export const requestHeaders: fc.Arbitrary<RequestHeaders> = fc
  .tuple(userAgentHeader, acceptEncodingHeader, ifNoneMatchHeader)
  .map(([ua, enc, inm]) => ({
    "user-agent": ua,
    "accept-encoding": enc,
    "if-none-match": inm,
  }));
