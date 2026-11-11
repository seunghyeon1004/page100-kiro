import { formatHeaderClock } from "../pages/frame-time.js";
import { lookupPage } from "../pages/page-lookup.js";
import { FAVICON_SVG, ROBOTS_TXT } from "./assets.js";
import type { Asset, AssetTable } from "./assets.js";
import { compress, createBodyCache } from "./compress.js";
import { baseHeaders } from "./headers.js";
import { chooseEncoding, ifNoneMatch, isTerminalAgent } from "./negotiate.js";
import type { Encoding } from "./negotiate.js";
import { renderFrag, renderHtml, screenOf } from "./render-html.js";
import { renderJson, renderStatusJson } from "./render-json.js";
import { renderPlain } from "./render-plain.js";
import type { PlainKind } from "./render-plain.js";
import { renderAnsi, renderTxt } from "./render-screen.js";
import type { StoreReader } from "./store.js";
import { missingSubpageView, notInServiceView, pageView } from "./views.js";
import type { Format, View } from "./views.js";

// The router (server-and-viewer requirements 7 and 8): a pure function from a request to a
// response over the store, the asset table and a clock. It reads no file, makes no fetch and
// calls no model (requirement 7.1); nothing it imports from `src/sources`, `src/editor` or
// `src/compilers` is a value (requirement 1.4).

export interface RouterRequest {
  readonly method: string;
  /** The raw request target, as received. */
  readonly url: string;
  /** Header names in lower case, as `node:http` gives them. */
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface RouterResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

export interface RouterDeps {
  readonly store: StoreReader;
  readonly assets: AssetTable;
  readonly clock: () => Date;
}

const MAX_PATH = 1024;
const PAGE_ROUTE = /^\/([0-9]{3})(?:\.(txt|ansi|json|frag))?$/;

const CONTENT_TYPE: Readonly<Record<Format, string>> = {
  html: "text/html; charset=utf-8",
  frag: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  ansi: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
};

const TEXT = "text/plain; charset=utf-8";
const HTML = CONTENT_TYPE.html;

const SUFFIX: Readonly<Record<Encoding, string>> = { br: "-br", gzip: "-gz", identity: "" };
const CONTENT_ENCODING: Readonly<Record<Encoding, string | undefined>> = {
  br: "br",
  gzip: "gzip",
  identity: undefined,
};

/** The format an extension names; the route pattern allows only these four. */
function extensionFormat(extension: string): Format {
  switch (extension) {
    case "txt":
    case "ansi":
    case "json":
    case "frag":
      return extension;
    default:
      return "html";
  }
}

const encoder = new TextEncoder();
const EMPTY = new Uint8Array(0);

/** How a response is cached and varied; the router turns it into headers. */
interface Policy {
  readonly cache: string;
  readonly vary?: string;
  readonly etag?: string;
  readonly encoding?: Encoding;
  readonly extra?: Readonly<Record<string, string>>;
}

const PAGE_CACHE = "public, max-age=60";
const NO_STORE = "no-store";
const VARY_BOTH = "Accept-Encoding, User-Agent";
const VARY_ENCODING = "Accept-Encoding";

function build(
  request: RouterRequest,
  status: number,
  contentType: string,
  body: Uint8Array,
  policy: Policy,
): RouterResponse {
  const headers: Record<string, string> = {
    ...baseHeaders(contentType),
    "Content-Length": String(body.byteLength),
    "Cache-Control": policy.cache,
  };
  if (policy.vary !== undefined) headers.Vary = policy.vary;
  if (policy.etag !== undefined) headers.ETag = policy.etag;
  const contentEncoding = CONTENT_ENCODING[policy.encoding ?? "identity"];
  if (contentEncoding !== undefined) headers["Content-Encoding"] = contentEncoding;
  for (const [name, value] of Object.entries(policy.extra ?? {})) headers[name] = value;
  return { status, headers, body: request.method === "HEAD" ? EMPTY : body };
}

function plainText(request: RouterRequest, status: number, text: string, extra?: Policy["extra"]) {
  return build(request, status, TEXT, encoder.encode(text), {
    cache: NO_STORE,
    ...(extra === undefined ? {} : { extra }),
  });
}

/** The response of a 304: the validators of the 200 and no body. */
function notModified(request: RouterRequest, contentType: string, policy: Policy): RouterResponse {
  const response = build({ ...request, method: "GET" }, 304, contentType, EMPTY, policy);
  return { ...response, headers: { ...response.headers, "Content-Length": "0" } };
}

interface Target {
  readonly path: string;
  readonly query: URLSearchParams;
}

function parseTarget(url: string): Target {
  const mark = url.indexOf("?");
  const path = mark === -1 ? url : url.slice(0, mark);
  const query = new URLSearchParams(mark === -1 ? "" : url.slice(mark + 1));
  return { path, query };
}

export type Router = (request: RouterRequest) => RouterResponse;

export function createRouter(deps: RouterDeps): Router {
  const { store, assets, clock } = deps;
  const cache = createBodyCache();
  /** The page ETag last served for each page number, so a replaced version's bodies can be dropped. */
  const served = new Map<number, string>();

  function plainPage(request: RouterRequest, status: 400 | 404, kind: PlainKind): RouterResponse {
    const terminal = isTerminalAgent(request.headers["user-agent"]);
    const text = renderPlain(kind, terminal, assets.urls);
    return encoded(request, status, terminal ? TEXT : HTML, text, {
      cache: NO_STORE,
      vary: VARY_BOTH,
    });
  }

  /** A body that is text, in the encoding the request accepts; no ETag, nothing cached. */
  function encoded(
    request: RouterRequest,
    status: number,
    contentType: string,
    text: string,
    policy: Policy,
  ): RouterResponse {
    const encoding = chooseEncoding(request.headers["accept-encoding"]);
    const body = compress(encoder.encode(text), encoding, "page");
    return build(request, status, contentType, body, { ...policy, encoding });
  }

  function renderView(view: View, format: Format, urls: AssetTable["urls"]): string {
    switch (format) {
      case "html":
        return renderHtml(view, urls);
      case "frag":
        return renderFrag(view);
      case "txt":
        return renderTxt(screenOf(view), view.reveal);
      case "ansi":
        return renderAnsi(screenOf(view), view.reveal);
      case "json":
        return renderJson(view);
    }
  }

  /** A view in one format: 304 on a matching tag, else the (cached) encoded body. */
  function viewResponse(
    request: RouterRequest,
    view: View,
    format: Format,
    varyUserAgent: boolean,
  ): RouterResponse {
    const now = view.now;
    const encoding = chooseEncoding(request.headers["accept-encoding"]);
    const vary = varyUserAgent ? VARY_BOTH : VARY_ENCODING;
    const contentType = CONTENT_TYPE[format];
    const { page } = view;

    if (page.etag === "") {
      const text = renderView(view, format, assets.urls);
      return encoded(request, view.status, contentType, text, { cache: PAGE_CACHE, vary });
    }

    const previous = served.get(page.number);
    if (previous !== undefined && previous !== page.etag) cache.evict(previous);
    served.set(page.number, page.etag);

    const subpage = format === "json" ? "a" : String(view.subpage + 1);
    const revealed = view.reveal && (format === "html" || format === "txt" || format === "ansi");
    const base = `${page.etag}-${subpage}-${format}${revealed ? "-r" : ""}`;
    const etag = `"${base}${SUFFIX[encoding]}"`;
    const policy: Policy = { cache: PAGE_CACHE, vary, etag, encoding };
    if (ifNoneMatch(request.headers["if-none-match"], etag)) {
      return notModified(request, contentType, policy);
    }

    const clockText = formatHeaderClock(now);
    let body = encoding === "identity" ? undefined : cache.get(etag, clockText);
    if (body === undefined) {
      body = compress(encoder.encode(renderView(view, format, assets.urls)), encoding, "page");
      if (encoding !== "identity") cache.set(etag, clockText, body);
    }
    return build(request, view.status, contentType, body, policy);
  }

  function pageRoute(
    request: RouterRequest,
    digits: string,
    extension: string | undefined,
    query: URLSearchParams,
  ): RouterResponse {
    const found = lookupPage(digits);
    if (found.kind === "not-a-page-number") return plainPage(request, 404, "not-found");

    const terminal = isTerminalAgent(request.headers["user-agent"]);
    const format: Format =
      extension === undefined ? (terminal ? "ansi" : "html") : extensionFormat(extension);
    const varyUserAgent = extension === undefined;
    const now = clock();
    const reveal = query.get("reveal") === "1";

    if (found.kind === "not-in-service") {
      const view = notInServiceView(found.number, now);
      if (view === undefined) return plainPage(request, 404, "not-found");
      return viewResponse(request, { ...view, reveal }, format, varyUserAgent);
    }

    const page = store.get(found.def.number);
    if (page === undefined) {
      return plainText(request, 503, "Service starting. Try again in a minute.\n", {
        "Retry-After": "60",
      });
    }

    let subpage = 0;
    if (format !== "json") {
      const values = query.getAll("s");
      if (values.length > 0) {
        const text = values.length === 1 ? (values[0] ?? "") : "";
        const wanted = /^[1-9]$/.test(text) ? Number(text) : 0;
        if (wanted < 1 || wanted > page.screens.length) {
          const missing = missingSubpageView(page, now);
          if (missing === undefined) return plainPage(request, 404, "not-found");
          return viewResponse(request, { ...missing, reveal }, format, varyUserAgent);
        }
        subpage = wanted - 1;
      }
    }
    return viewResponse(request, pageView(page, subpage, now, reveal), format, varyUserAgent);
  }

  function assetResponse(request: RouterRequest, path: string): RouterResponse {
    const asset: Asset | undefined = assets.get(path);
    if (asset === undefined) return plainPage(request, 404, "not-found");
    const encoding: Encoding =
      asset.br === null || asset.gzip === null
        ? "identity"
        : chooseEncoding(request.headers["accept-encoding"]);
    const body =
      encoding === "br"
        ? (asset.br ?? asset.body)
        : encoding === "gzip"
          ? (asset.gzip ?? asset.body)
          : asset.body;
    const compressible = asset.br !== null;
    const etag = `${asset.etag.slice(0, -1)}${SUFFIX[encoding]}"`;
    const policy: Policy = {
      cache: "public, max-age=31536000, immutable",
      etag,
      encoding,
      ...(compressible ? { vary: VARY_ENCODING } : {}),
    };
    if (ifNoneMatch(request.headers["if-none-match"], etag)) {
      return notModified(request, asset.contentType, policy);
    }
    return build(request, 200, asset.contentType, body, policy);
  }

  function staticText(request: RouterRequest, contentType: string, text: string) {
    return encoded(request, 200, contentType, text, {
      cache: "public, max-age=86400",
      vary: VARY_ENCODING,
    });
  }

  function route(request: RouterRequest): RouterResponse {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return plainText(request, 405, "Method not allowed\n", { Allow: "GET, HEAD" });
    }
    const { path, query } = parseTarget(request.url);
    if (path.length > MAX_PATH) return plainPage(request, 404, "not-found");

    if (path === "/") return pageRoute(request, "100", undefined, query);
    const match = PAGE_ROUTE.exec(path);
    if (match !== null) return pageRoute(request, match[1] ?? "", match[2], query);

    switch (path) {
      case "/go": {
        const p = query.get("p") ?? "";
        if (!/^[0-9]{3}$/.test(p)) return plainPage(request, 400, "bad-request");
        return build(request, 303, TEXT, EMPTY, { cache: NO_STORE, extra: { Location: `/${p}` } });
      }
      case "/api/health":
        return store.list().length > 0
          ? plainText(request, 200, "ok\n")
          : plainText(request, 503, "starting\n");
      case "/api/status":
        return build(request, 200, CONTENT_TYPE.json, encoder.encode(renderStatusJson(store)), {
          cache: NO_STORE,
        });
      case "/robots.txt":
        return staticText(request, TEXT, ROBOTS_TXT);
      case "/favicon.svg":
        return staticText(request, "image/svg+xml", FAVICON_SVG);
      default:
        break;
    }
    if (path.startsWith("/assets/")) return assetResponse(request, path);
    return plainPage(request, 404, "not-found");
  }

  return (request) => {
    try {
      return route(request);
    } catch {
      // Property 5 shows this is unreachable (requirement 7.9).
      return {
        status: 500,
        headers: { ...baseHeaders(TEXT), "Content-Length": "22", "Cache-Control": NO_STORE },
        body: request.method === "HEAD" ? EMPTY : encoder.encode("Internal server error\n"),
      };
    }
  };
}
