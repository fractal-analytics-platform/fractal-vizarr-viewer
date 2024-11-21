import type { Request } from "express";
import { caching } from "cache-manager";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { User } from "./types";

const config = getConfig();
const logger = getLogger();

// cache TTL in milliseconds
const ttl = config.cacheExpirationTime * 1000;

const tokensCache = await caching("memory", { ttl });

// Track the tokens for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingTokens: string[] = [];

export async function getUserFromRequest(
  req: Request
): Promise<{ token: string; user: User } | undefined> {
  const token = getUserTokenFromRequest(req);
  if (!token) {
    logger.debug("Missing cookie or token header");
    return undefined;
  }
  while (loadingTokens.includes(token)) {
    // a fetch call for this token is in progress; wait for its completion
    await new Promise((r) => setTimeout(r));
  }
  loadingTokens.push(token);
  let user: User | undefined = undefined;
  try {
    const value: string | undefined = await tokensCache.get(token);
    if (value) {
      user = JSON.parse(value);
    } else {
      logger.trace("Retrieving user from token");
      const response = await fetch(
        `${config.fractalServerUrl}/auth/current-user/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        user = (await response.json()) as User;
        logger.trace("Retrieved user %s", user.email);
        tokensCache.set(token, JSON.stringify(user));
      } else {
        logger.debug(
          "Fractal server replied with %d while retrieving user from token",
          response.status
        );
      }
    }
  } finally {
    loadingTokens = loadingTokens.filter((t) => t !== token);
  }
  if (user === undefined) {
    return undefined;
  }
  return { token, user };
}

function getUserTokenFromRequest(req: Request): string | undefined {
  const cookie = req.get("Cookie");
  if (cookie) {
    const cookieToken = extractTokenFromCookie(cookie);
    if (cookieToken) {
      return cookieToken;
    }
  }
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    return undefined;
  }
  const match = authHeader.match(/Bearer (.*)/i);
  if (!match) {
    return undefined;
  }
  console.log('match', match[1])
  return match[1];
}

function extractTokenFromCookie(cookie: string) {
  const fastApiCookie = cookie
    .split(";")
    .find((c) => c.match(/fastapiusersauth=.*/));
  if (!fastApiCookie) {
    return;
  }
  return fastApiCookie.split("=")[1].trim();
}
