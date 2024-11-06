import * as dotenv from "dotenv";
import { getLogger } from "./logger.js";
import { AuthorizationScheme, Config } from "./types";

// Loading environment variables
dotenv.config();

const logger = getLogger();

function getRequiredEnv(envName: string) {
  const value = process.env[envName];
  if (!value) {
    logger.error(
      "Missing required environment variable %s. Check the configuration.",
      envName
    );
    process.exit(1);
  }
  return value;
}

/**
 * @returns the service configuration
 */
function loadConfig(): Config {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const fractalServerUrl = getRequiredEnv("FRACTAL_SERVER_URL");
  const vizarrStaticFilesPath = getRequiredEnv("VIZARR_STATIC_FILES_PATH");

  const validAuthorizationSchemes = [
    "fractal-server-viewer-paths",
    "user-folders",
    "testing-basic-auth",
    "none",
  ];
  const authorizationScheme = getRequiredEnv("AUTHORIZATION_SCHEME");
  if (!validAuthorizationSchemes.includes(authorizationScheme)) {
    logger.error(
      'Invalid authorization scheme "%s", allowed values: %s',
      authorizationScheme,
      validAuthorizationSchemes.map((v) => `"${v}"`).join(", ")
    );
    process.exit(1);
  }

  let zarrDataBasePath: string | null = null;
  if (authorizationScheme !== "fractal-server-viewer-paths") {
    zarrDataBasePath = getRequiredEnv("ZARR_DATA_BASE_PATH");
  } else if (process.env.ZARR_DATA_BASE_PATH) {
    logger.error(
      `ZARR_DATA_BASE_PATH will be ignored because AUTHORIZATION_SCHEME is set to fractal-server-viewer-paths`
    );
    process.exit(1);
  }

  let testingUsername: string | null = null;
  let testingPassword: string | null = null;
  if (authorizationScheme === "testing-basic-auth") {
    testingUsername = getRequiredEnv("TESTING_USERNAME");
    testingPassword = getRequiredEnv("TESTING_PASSWORD");
  }

  // Cookie cache TTL in seconds
  const cacheExpirationTime = process.env.CACHE_EXPIRATION_TIME
    ? parseInt(process.env.CACHE_EXPIRATION_TIME)
    : 60;

  let basePath = process.env.BASE_PATH || "/vizarr";
  if (!basePath.endsWith("/")) {
    basePath += "/";
  }

  logger.debug("FRACTAL_SERVER_URL: %s", fractalServerUrl);
  logger.debug("BASE_PATH: %s", basePath);
  if (zarrDataBasePath) {
    logger.debug("ZARR_DATA_BASE_PATH: %s", zarrDataBasePath);
  }
  logger.debug("VIZARR_STATIC_FILES_PATH: %s", vizarrStaticFilesPath);
  logger.debug("AUTHORIZATION_SCHEME: %s", authorizationScheme);
  logger.debug("CACHE_EXPIRATION_TIME: %d", cacheExpirationTime);

  return {
    port,
    fractalServerUrl,
    basePath,
    zarrDataBasePath,
    vizarrStaticFilesPath,
    authorizationScheme: authorizationScheme as AuthorizationScheme,
    cacheExpirationTime,
    testingUsername,
    testingPassword,
  };
}

let config: Config | null = null;

/**
 * Loads the configuration from environment variables.
 * @returns the service configuration
 */
export function getConfig(): Config {
  if (config === null) {
    config = loadConfig();
  }
  return config;
}
