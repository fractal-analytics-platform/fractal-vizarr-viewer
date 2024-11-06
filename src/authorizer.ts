import * as path from "path";
import type { Request } from "express";
import { caching } from "cache-manager";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { UserSettings } from "./types";
import { getUserFromCookie } from "./user.js";
import { isSubfolder } from "./path.js";

const config = getConfig();
const logger = getLogger();

// cache TTL in milliseconds
const ttl = config.cacheExpirationTime * 1000;

const settingsCache = await caching("memory", { ttl });
const viewerPathsCache = await caching("memory", { ttl });

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingSettings: string[] = [];
let loadingViewerPaths: string[] = [];

/**
 * Returns the class that performs the authorization logic.
 */
export function getAuthorizer() {
  switch (config.authorizationScheme) {
    case "fractal-server-viewer-paths":
      return new ViewerPathsAuthorizer();
    case "user-folders":
      return new UserFoldersAuthorizer();
    case "none":
      logger.warn(
        'Authorization scheme is set to "none": everybody will be able to access the file. Do not use in production!'
      );
      return new NoneAuthorizer();
    default:
      logger.error(
        "Unsupported authorization scheme %s",
        config.authorizationScheme
      );
      process.exit(1);
  }
}

export interface Authorizer {
  /**
   * Returns true if the request comes from a valid user, false otherwise.
   */
  isUserValid(req: Request): Promise<boolean>;

  /**
   * Returns true if the user is authorized to read the file path passed as first argument, false otherwise.
   */
  isUserAuthorized(completePath: string, req: Request): Promise<boolean>;
}

export class NoneAuthorizer implements Authorizer {
  async isUserValid(): Promise<boolean> {
    return true;
  }

  async isUserAuthorized(): Promise<boolean> {
    return true;
  }
}

export class UserFoldersAuthorizer implements Authorizer {
  async isUserValid(req: Request): Promise<boolean> {
    const user = await getUserFromCookie(req.get("Cookie"));
    return !!user;
  }

  async isUserAuthorized(completePath: string, req: Request): Promise<boolean> {
    const cookie = req.get("Cookie");
    const user = await getUserFromCookie(cookie);
    if (!user || !cookie) {
      return false;
    }
    while (loadingSettings.includes(cookie)) {
      // a fetch call for this cookie is in progress; wait for its completion
      await new Promise((r) => setTimeout(r));
    }
    loadingSettings.push(cookie);
    let settings: UserSettings | undefined = undefined;
    try {
      const value: string | undefined = await settingsCache.get(cookie);
      if (value) {
        settings = JSON.parse(value) as UserSettings;
      } else {
        logger.trace("Retrieving settings from cookie");
        const response = await fetch(
          `${config.fractalServerUrl}/auth/current-user/settings/`,
          {
            headers: {
              Cookie: cookie,
            },
          }
        );
        if (response.ok) {
          settings = (await response.json()) as UserSettings;
          logger.trace("Retrieved settings for user %s", user.email);
          settingsCache.set(cookie, JSON.stringify(settings));
        } else {
          logger.debug(
            "Fractal server replied with %d while retrieving settings from cookie",
            response.status
          );
          return false;
        }
      }
    } finally {
      loadingSettings = loadingSettings.filter((c) => c !== cookie);
    }
    const username = settings.slurm_user;
    if (!username) {
      logger.warn('Slurm user is not defined for "%s"', user.email);
      return false;
    }
    const userPath = path.join(config.zarrDataBasePath!, username);
    if (!isSubfolder(config.zarrDataBasePath!, userPath)) {
      return false;
    }
    return completePath.startsWith(userPath);
  }
}

export class ViewerPathsAuthorizer implements Authorizer {
  async isUserValid(req: Request): Promise<boolean> {
    const user = await getUserFromCookie(req.get("Cookie"));
    return !!user;
  }

  async isUserAuthorized(completePath: string, req: Request): Promise<boolean> {
    const cookie = req.get("Cookie");
    const user = await getUserFromCookie(cookie);
    if (!user || !cookie) {
      return false;
    }
    while (loadingViewerPaths.includes(cookie)) {
      // a fetch call for this cookie is in progress; wait for its completion
      await new Promise((r) => setTimeout(r));
    }
    loadingViewerPaths.push(cookie);
    try {
      let viewerPaths: string[] | undefined = await viewerPathsCache.get(
        cookie
      );
      if (viewerPaths === undefined) {
        logger.trace("Retrieving viewer paths for user %s", user.email);
        const response = await fetch(
          `${config.fractalServerUrl}/auth/current-user/viewer-paths/`,
          {
            headers: {
              Cookie: cookie,
            },
          }
        );
        if (response.ok) {
          viewerPaths = (await response.json()) as string[];
          logger.trace(
            "Retrieved %d viewer paths for user %s",
            viewerPaths.length,
            user.email
          );
          viewerPathsCache.set(cookie, viewerPaths);
        } else {
          logger.debug(
            "Fractal server replied with %d while retrieving viewer paths for user %s",
            response.status,
            user.email
          );
          return false;
        }
      }
      for (const viewerPath of viewerPaths) {
        if (path.resolve(completePath).startsWith(viewerPath)) {
          return true;
        }
      }
      logger.trace("Unauthorized path %s", completePath);
      return false;
    } finally {
      loadingViewerPaths = loadingViewerPaths.filter((c) => c !== cookie);
    }
  }
}
