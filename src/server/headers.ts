// The headers every response carries (server-and-viewer 8.1; frontend.md, "Security headers and CSP").

/** The policy of frontend.md, exactly. */
export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

/** The security headers and `Content-Type`; the router adds `Content-Length`, `Cache-Control`, `Vary`, `ETag` and `Content-Encoding`. */
export function baseHeaders(contentType: string): Record<string, string> {
  return {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Type": contentType,
  };
}
