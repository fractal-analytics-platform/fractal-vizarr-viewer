import * as path from "path";
import type { Request } from "express";
import { caching } from "cache-manager";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { User, UserSettings } from "./types";
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
    case "testing-basic-auth":
      logger.warn(
        'Authorization scheme is set to "testing-basic-auth". Do not use in production!'
      );
      return new TestingBasicAuthAuthorizer();
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

  async isUserAuthorized(completePath: string): Promise<boolean> {
    return isSubfolder(config.zarrDataBasePath!, completePath);
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
    const settings = await getUserSettings(user, cookie);
    if (!settings) {
      return false;
    }

    if (
      settings.project_dir &&
      isSubfolder(settings.project_dir, completePath)
    ) {
      return true;
    }

    const username = settings.slurm_user;
    if (!username) {
      logger.warn('Slurm user is not defined for "%s"', user.email);
      return false;
    }

    const userPath = path.join(config.zarrDataBasePath!, username);
    return isSubfolder(userPath, completePath);
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
    const settings = await getUserSettings(user, cookie);
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
      const allowedPaths =
        settings && settings.project_dir
          ? [settings.project_dir, ...viewerPaths]
          : viewerPaths;
      for (const allowedPath of allowedPaths) {
        if (isSubfolder(allowedPath, completePath)) {
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

async function getUserSettings(
  user: User,
  cookie: string
): Promise<UserSettings | undefined> {
  while (loadingSettings.includes(cookie)) {
    // a fetch call for this cookie is in progress; wait for its completion
    await new Promise((r) => setTimeout(r));
  }
  loadingSettings.push(cookie);
  try {
    const value: string | undefined = await settingsCache.get(cookie);
    if (value) {
      return JSON.parse(value) as UserSettings;
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
        const settings = (await response.json()) as UserSettings;
        logger.trace("Retrieved settings for user %s", user.email);
        settingsCache.set(cookie, JSON.stringify(settings));
        return settings;
      } else {
        logger.debug(
          "Fractal server replied with %d while retrieving settings from cookie",
          response.status
        );
        return undefined;
      }
    }
  } finally {
    loadingSettings = loadingSettings.filter((c) => c !== cookie);
  }
}

export class TestingBasicAuthAuthorizer implements Authorizer {
  async isUserValid(req: Request): Promise<boolean> {
    const authHeader = req.get("Authorization");
    return !!authHeader;
  }

  async isUserAuthorized(completePath: string, req: Request): Promise<boolean> {
    const authHeader = req.get("Authorization")!;
    const [scheme, credentials] = authHeader.split(" ");
    if (scheme !== "Basic" || !credentials) {
      return false;
    }
    const [username, password] = Buffer.from(credentials, "base64")
      .toString()
      .split(":");
    if (
      username !== config.testingUsername ||
      password !== config.testingPassword
    ) {
      return false;
    }
    return isSubfolder(config.zarrDataBasePath!, completePath);
  }
}
