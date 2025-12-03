/**
 * Proxy-aware fetch utility for server-side HTTP requests.
 *
 * Supports standard proxy environment variables:
 * - HTTP_PROXY / http_proxy
 * - HTTPS_PROXY / https_proxy
 * - NO_PROXY / no_proxy
 *
 * If no proxy environment variables are set, uses native fetch directly.
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

// Cache the proxy agent to avoid creating new connections for each request
let cachedProxyAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | null = null;

/**
 * Get proxy URL from environment variables
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
 * Parse NO_PROXY environment variable into a list of patterns
 */
function getNoProxyPatterns(): string[] {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy) return [];

  return noProxy
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if a URL should bypass the proxy based on NO_PROXY patterns
 */
function shouldBypassProxy(targetUrl: string): boolean {
  const patterns = getNoProxyPatterns();
  if (patterns.length === 0) return false;

  try {
    const url = new URL(targetUrl);
    const hostname = url.hostname.toLowerCase();

    for (const pattern of patterns) {
      // Exact match
      if (hostname === pattern) return true;

      // Wildcard match (e.g., .example.com matches sub.example.com)
      if (pattern.startsWith(".") && hostname.endsWith(pattern)) return true;

      // Domain suffix match (e.g., example.com matches sub.example.com)
      if (hostname.endsWith("." + pattern)) return true;

      // Match localhost variants
      if (pattern === "localhost" && (hostname === "localhost" || hostname === "127.0.0.1")) {
        return true;
      }

      // IP address match
      if (hostname === pattern) return true;
    }
  } catch {
    // Invalid URL, don't bypass proxy
  }

  return false;
}

/**
 * Get or create proxy agent (cached for performance)
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
 * Proxy-aware fetch function for server-side requests.
 *
 * Usage:
 * ```ts
 * import { proxyFetch } from "@/lib/proxy-fetch";
 *
 * const response = await proxyFetch("https://api.github.com/user", {
 *   headers: { Authorization: "Bearer token" }
 * });
 * ```
 *
 * Respects HTTP_PROXY, HTTPS_PROXY, and NO_PROXY environment variables.
 */
export async function proxyFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const proxyUrl = getProxyUrl();

  // No proxy configured or URL should bypass proxy - use native fetch
  if (!proxyUrl || shouldBypassProxy(url)) {
    return fetch(input, init);
  }

  // Use undici with proxy agent
  const dispatcher = getProxyAgent(proxyUrl);

  // undici fetch has slightly different types, cast as needed
  const response = await undiciFetch(url, {
    ...init,
    dispatcher,
  } as Parameters<typeof undiciFetch>[1]);

  return response as unknown as Response;
}

/**
 * Check if proxy is configured in environment
 */
export function isProxyConfigured(): boolean {
  return !!getProxyUrl();
}

/**
 * Get current proxy configuration for debugging
 */
export function getProxyConfig(): {
  proxyUrl: string | undefined;
  noProxyPatterns: string[];
} {
  return {
    proxyUrl: getProxyUrl(),
    noProxyPatterns: getNoProxyPatterns(),
  };
}
