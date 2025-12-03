/**
 * Proxy-aware fetch for NextAuth OAuth providers.
 *
 * Auth.js (NextAuth v5) supports custom fetch through the customFetch symbol.
 * This module provides a proxy-compatible fetch function for OAuth flows.
 *
 * @see https://authjs.dev/guides/corporate-proxy
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

// Cache proxy agent for connection reuse
let cachedProxyAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | null = null;

/**
 * Get proxy URL from environment
 */
function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  );
}

/**
 * Get or create cached proxy agent
 */
function getProxyAgent(proxyUrl: string): ProxyAgent {
  if (cachedProxyAgent && cachedProxyUrl === proxyUrl) {
    return cachedProxyAgent;
  }
  cachedProxyAgent = new ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;
  return cachedProxyAgent;
}

/**
 * Proxy-aware fetch function for NextAuth providers.
 *
 * Usage with Auth.js customFetch:
 * ```ts
 * import { customFetch } from "next-auth"
 * import { authProxyFetch } from "./auth-proxy"
 *
 * GitHub({
 *   [customFetch]: authProxyFetch,
 * })
 * ```
 */
export function authProxyFetch(
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  const proxyUrl = getProxyUrl();

  // No proxy - use native fetch
  if (!proxyUrl) {
    return fetch(args[0], args[1]);
  }

  // Use undici with proxy dispatcher
  const dispatcher = getProxyAgent(proxyUrl);

  // @ts-expect-error undici has slightly different types but is compatible
  return undiciFetch(args[0], { ...args[1], dispatcher }) as ReturnType<typeof fetch>;
}
