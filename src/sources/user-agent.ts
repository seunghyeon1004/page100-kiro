/** The package version. A test compares it with `package.json` (requirement 10.2). */
export const PACKAGE_VERSION = "0.1.0";

/** Sent with every request (sources.md, "HTTP client"). The URL is the repository until a deploy host exists. */
export const USER_AGENT = `Page100/${PACKAGE_VERSION} (teletext revival, Kiroween 2026; +https://github.com/seunghyeon1004/page100-kiro)`;

/**
 * The User-Agent for a deploy (server-and-viewer 5.9): `USER_AGENT` while `publicOrigin` is `null`,
 * else the same text with `+<publicOrigin>/801` in place of the repository URL.
 */
export function userAgent(publicOrigin: string | null): string {
  if (publicOrigin === null) return USER_AGENT;
  return `Page100/${PACKAGE_VERSION} (teletext revival, Kiroween 2026; +${publicOrigin}/801)`;
}
