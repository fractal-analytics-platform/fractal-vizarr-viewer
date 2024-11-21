import type { Request } from "express";
import { caching } from "cache-manager";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { getUserFromCookie } from "./user.js";
import { isSubfolder } from "./path.js";

const config = getConfig();
const logger = getLogger();

// cache TTL in milliseconds
const ttl = config.cacheExpirationTime * 1000;

const viewerPathsCache = await caching("memory", { ttl });

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingViewerPaths: string[] = [];

/**
 * Returns the class that performs the authorization logic.
 */
export function getAuthorizer() {
  switch (config.authorizationScheme) {
    case "fractal-server":
      return new FractalServerAuthorizer();
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

  async isUserAuthorized(): Promise<boolean> {
    return true;
  }
}

export class FractalServerAuthorizer implements Authorizer {
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
      let allowedPaths: string[] | undefined = await viewerPathsCache.get(
        cookie
      );
      if (allowedPaths === undefined) {
        logger.trace("Retrieving allowed viewer paths for user %s", user.email);
        const response = await fetch(
          `${config.fractalServerUrl}/auth/current-user/allowed-viewer-paths/`,
          {
            headers: {
              Cookie: cookie,
            },
          }
        );
        if (response.ok) {
          allowedPaths = (await response.json()) as string[];
          logger.trace(
            "Retrieved %d allowed viewer paths for user %s",
            allowedPaths.length,
            user.email
          );
          viewerPathsCache.set(cookie, allowedPaths);
        } else {
          logger.debug(
            "Fractal server replied with %d while retrieving allowed viewer paths for user %s",
            response.status,
            user.email
          );
          return false;
        }
      }
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

export class TestingBasicAuthAuthorizer implements Authorizer {
  async isUserValid(req: Request): Promise<boolean> {
    const authHeader = req.get("Authorization");
    return !!authHeader;
  }

  async isUserAuthorized(_: string, req: Request): Promise<boolean> {
    const authHeader = req.get("Authorization")!;
    const [scheme, credentials] = authHeader.split(" ");
    if (scheme !== "Basic" || !credentials) {
      return false;
    }
    const [username, password] = Buffer.from(credentials, "base64")
      .toString()
      .split(":");
    return (
      username === config.testingUsername && password === config.testingPassword
    );
  }
}
