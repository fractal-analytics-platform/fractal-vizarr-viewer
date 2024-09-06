import * as path from 'path';
// Needed for node 16
import fetch from 'node-fetch';
import type { Request } from 'express';
import { caching } from 'cache-manager';
import { getConfig } from './config.js';
import { getLogger } from "./logger.js";
import { User } from "./types";

const config = getConfig();
const logger = getLogger();

const cookiesCache = await caching('memory', {
  ttl: config.cacheExpirationTime * 1000 // milliseconds
});

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingCookies: string[] = [];

/**
 * Returns the class that performs the authorization logic.
 */
export function getAuthorizer() {
  switch (config.authorizationScheme) {
    case 'allowed-list':
      return new AllowedListAuthorizer();
    case 'user-folders':
      return new UserFoldersAuthorizer();
    case 'none':
      logger.warn('Authorization scheme is set to "none": everybody will be able to access the file. Do not use in production!');
      return new NoneAuthorizer();
    default:
      logger.error('Unsupported authorization scheme %s', config.authorizationScheme);
      process.exit(1);
  }
}

abstract class BaseAuthorizer {

  /**
   * Returns the requested file path if authorized, undefined otherwise.
   */
  async getAuthorizedPath(req: Request): Promise<string | undefined> {
    const completePath = this.getValidPath(req);
    if (!completePath) {
      return;
    }
    const user = await this.getUserFromCookie(req);
    if (!this.isUserAuthorized(completePath, user)) {
      return undefined;
    }
    logger.trace("Path to load: %s", completePath);
    return completePath;
  }

  getValidPath(req: Request): string | undefined {
    const requestPath = req.path.normalize();
    const completePath = requestPath.startsWith(config.zarrDataBasePath) ?
      requestPath : path.join(config.zarrDataBasePath, requestPath);
    // Ensure that the selected path is a subfolder of the base data folder
    if (this.isSubfolder(config.zarrDataBasePath, completePath)) {
      return completePath;
    }
    return undefined;
  }

  /**
   * Ensures that a path to check is a subfolder of a given parent folder.
   */
  isSubfolder(parentFolder: string, pathToCheck: string): boolean {
    const result = !path.relative(parentFolder, pathToCheck).includes('..');
    if (!result) {
      logger.warn('Path "%s" is not a subfolder of "%s"', pathToCheck, parentFolder);
    }
    return result;
  }

  abstract isUserAuthorized(completePath: string, user: User | undefined): boolean;

  async getUserFromCookie(req: Request): Promise<User | undefined> {
    const cookie = req.get('Cookie');
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
}

export class AllowedListAuthorizer extends BaseAuthorizer {
  isUserAuthorized(_: string, user: User | undefined): boolean {
    if (!user) {
      return false;
    }
    const authorized = config.allowedUsers.includes(user.email);
    if (!authorized) {
      logger.debug("User is not in the list of allowed users");
    }
    return authorized;
  }
}

export class NoneAuthorizer extends BaseAuthorizer {
  isUserAuthorized(): boolean {
    return true;
  }
}

export class UserFoldersAuthorizer extends BaseAuthorizer {
  isUserAuthorized(completePath: string, user: User | undefined): boolean {
    if (!user) {
      return false;
    }
    const username = user.slurm_user;
    if (!username) {
      logger.warn('Slurm user is not defined for "%s"', user.email);
      return false;
    }
    const userPath = path.join(config.zarrDataBasePath, username);
    if (!this.isSubfolder(config.zarrDataBasePath, userPath)) {
      return false;
    }
    return completePath.startsWith(userPath);
  }
}
