import * as path from 'path';
// Needed for node 16
import fetch from 'node-fetch';
import type { Request } from 'express';
import { caching } from 'cache-manager';
import { getConfig } from './config.js';
import { getLogger } from "./logger.js";
import { User, UserSettings } from "./types";

const config = getConfig();
const logger = getLogger();

// cache TTL in milliseconds
const ttl = config.cacheExpirationTime * 1000;

const cookiesCache = await caching('memory', { ttl });
const settingsCache = await caching('memory', { ttl });
const viewerPathsCache = await caching('memory', { ttl });

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingCookies: string[] = [];
let loadingSettings: string[] = [];
let loadingViewerPaths: string[] = [];

/**
 * Returns the class that performs the authorization logic.
 */
export function getAuthorizer() {
  switch (config.authorizationScheme) {
    case 'fractal-server-viewer-paths':
      return new ViewerPathsAuthorizer();
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
    const authorized = await this.isUserAuthorized(completePath, user, req.get('Cookie'));
    if (!authorized) {
      return undefined;
    }
    logger.trace("Path to load: %s", completePath);
    return completePath;
  }

  getValidPath(req: Request): string | undefined {
    const requestPath = req.path.normalize();
    if (!config.zarrDataBasePath) {
      return requestPath;
    }
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

  abstract isUserAuthorized(completePath: string, user: User | undefined, cookie: string | undefined): Promise<boolean>;

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
  async isUserAuthorized(_: string, user: User | undefined): Promise<boolean> {
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
  async isUserAuthorized(): Promise<boolean> {
    return true;
  }
}

export class UserFoldersAuthorizer extends BaseAuthorizer {
  async isUserAuthorized(completePath: string, user: User | undefined, cookie: string | undefined): Promise<boolean> {
    if (!user || !cookie) {
      return false;
    }
    while (loadingSettings.includes(cookie)) {
      // a fetch call for this cookie is in progress; wait for its completion
      await new Promise(r => setTimeout(r));
    }
    loadingSettings.push(cookie);
    let settings: UserSettings | undefined = undefined;
    try {
      const value: string | undefined = await settingsCache.get(cookie);
      if (value) {
        settings = JSON.parse(value) as UserSettings;
      } else {
        logger.trace("Retrieving settings from cookie");
        const response = await fetch(`${config.fractalServerUrl}/auth/current-user/settings/`, {
          headers: {
            'Cookie': cookie
          }
        });
        if (response.ok) {
          settings = await response.json() as UserSettings;
          logger.trace("Retrieved settings for user %s", user.email);
          settingsCache.set(cookie, JSON.stringify(settings));
        } else {
          logger.debug("Fractal server replied with %d while retrieving settings from cookie", response.status);
          return false;
        }
      }
    } finally {
      loadingSettings = loadingSettings.filter(c => c !== cookie);
    }
    const username = settings.slurm_user;
    if (!username) {
      logger.warn('Slurm user is not defined for "%s"', user.email);
      return false;
    }
    const userPath = path.join(config.zarrDataBasePath!, username);
    if (!this.isSubfolder(config.zarrDataBasePath!, userPath)) {
      return false;
    }
    return completePath.startsWith(userPath);
  }
}

export class ViewerPathsAuthorizer extends BaseAuthorizer {
  async isUserAuthorized(completePath: string, user: User | undefined, cookie: string | undefined): Promise<boolean> {
    if (!user || !cookie) {
      return false;
    }
    while (loadingViewerPaths.includes(cookie)) {
      // a fetch call for this cookie is in progress; wait for its completion
      await new Promise(r => setTimeout(r));
    }
    loadingViewerPaths.push(cookie);
    try {
      let viewerPaths: string[] | undefined = await viewerPathsCache.get(cookie);
      if (viewerPaths === undefined) {
        logger.trace('Retrieving viewer paths for user %s', user.email);
        const response = await fetch(`${config.fractalServerUrl}/auth/current-user/viewer-paths/`, {
          headers: {
            'Cookie': cookie
          }
        });
        if (response.ok) {
          viewerPaths = await response.json() as string[];
          logger.trace('Retrieved %d viewer paths for user %s', viewerPaths.length, user.email);
          viewerPathsCache.set(cookie, viewerPaths);
        } else {
          logger.debug('Fractal server replied with %d while retrieving viewer paths for user %s', response.status, user.email);
          return false;
        }
      }
      for (const viewerPath of viewerPaths) {
        if (path.resolve(completePath).startsWith(viewerPath)) {
          return true;
        }
      }
      logger.trace('Unauthorized path %s', completePath);
      return false;
    } finally {
      loadingViewerPaths = loadingViewerPaths.filter(c => c !== cookie);
    }
  }
}
