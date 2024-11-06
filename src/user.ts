import { caching } from 'cache-manager';
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { User } from './types';

const config = getConfig();
const logger = getLogger();

// cache TTL in milliseconds
const ttl = config.cacheExpirationTime * 1000;

const cookiesCache = await caching('memory', { ttl });

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingCookies: string[] = [];

export async function getUserFromCookie(cookie: string | undefined): Promise<User | undefined> {
  if (!cookie) {
    logger.debug("Missing cookie header");
    return undefined;
  }
  while (loadingCookies.includes(cookie)) {
    // a fetch call for this cookie is in progress; wait for its completion
    await new Promise(r => setTimeout(r));
  }
  loadingCookies.push(cookie);
  let user: User | undefined = undefined;
  try {
    const value: string | undefined = await cookiesCache.get(cookie);
    if (value) {
      user = JSON.parse(value);
    } else {
      logger.trace("Retrieving user from cookie");
      const response = await fetch(`${config.fractalServerUrl}/auth/current-user/`, {
        headers: {
          'Cookie': cookie
        }
      });
      if (response.ok) {
        user = await response.json() as User;
        logger.trace("Retrieved user %s", user.email);
        cookiesCache.set(cookie, JSON.stringify(user));
      } else {
        logger.debug("Fractal server replied with %d while retrieving user from cookie", response.status);
      }
    }
  } finally {
    loadingCookies = loadingCookies.filter(c => c !== cookie);
  }
  return user;
}
