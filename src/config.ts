import * as dotenv from 'dotenv'
import * as fs from 'fs';
import { getLogger } from "./logger.js";

// Loading environment variables
dotenv.config();

const logger = getLogger();

export type AuthorizationScheme = 'allowed-list' | 'user-folders' | 'none';

export type Config = {
  port: number
  fractalServerUrl: string
  basePath: string
  zarrDataBasePath: string
  vizarrStaticFilesPath: string
  authorizationScheme: AuthorizationScheme
  allowedUsers: string[]
  cacheExpirationTime: number
}

function getRequiredEnv(envName: string) {
  const value = process.env[envName];
  if (!value) {
    logger.error('Missing required environment variable %s. Check the configuration.', envName);
    process.exit(1);
  }
  return value;
}

function getAllowedUsers(allowedUsersFile?: string) {
  if (allowedUsersFile) {
    if (!fs.existsSync(allowedUsersFile)) {
      logger.error('Allowed users file not found: %s', allowedUsersFile);
      process.exit(1);
    }
    const allowedUsersData = fs.readFileSync(allowedUsersFile).toString();
    return allowedUsersData.split('\n').map(n => n.trim()).filter(n => !!n);
  }
  return [];
}

/**
 * @returns the service configuration
 */
export function getConfig(): Config {

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const fractalServerUrl = getRequiredEnv('FRACTAL_SERVER_URL');
  const zarrDataBasePath = getRequiredEnv('ZARR_DATA_BASE_PATH');
  const vizarrStaticFilesPath = getRequiredEnv('VIZARR_STATIC_FILES_PATH');

  const validAuthorizationSchemes = ['allowed-list', 'user-folders', 'none'];
  const authorizationScheme = process.env.AUTHORIZATION_SCHEME || 'allowed-list';
  if (!validAuthorizationSchemes.includes(authorizationScheme)) {
    logger.error('Invalid authorization scheme "%s", allowed values: %s', authorizationScheme,
      validAuthorizationSchemes.map(v => `"${v}"`).join(', '));
    process.exit(1);
  }

  const allowedUsersFile = process.env.ALLOWED_USERS;
  // Cookie cache TTL in seconds
  const cacheExpirationTime = process.env.CACHE_EXPIRATION_TIME ? parseInt(process.env.CACHE_EXPIRATION_TIME) : 60;

  let basePath = process.env.BASE_PATH || '/vizarr';
  if (!basePath.endsWith('/')) {
    basePath += '/';
  }

  const allowedUsers = getAllowedUsers(allowedUsersFile);

  logger.debug('FRACTAL_SERVER_URL: %s', fractalServerUrl);
  logger.debug('BASE_PATH: %s', basePath);
  logger.debug('ZARR_DATA_BASE_PATH: %s', zarrDataBasePath);
  logger.debug('VIZARR_STATIC_FILES_PATH: %s', vizarrStaticFilesPath);
  logger.debug('ALLOWED_USERS: %s', allowedUsersFile);
  if (allowedUsersFile) {
    logger.debug('Allowed users: %s', allowedUsers.join(', '));
  }
  logger.debug('CACHE_EXPIRATION_TIME: %d', cacheExpirationTime);

  return {
    port,
    fractalServerUrl,
    basePath,
    zarrDataBasePath,
    vizarrStaticFilesPath,
    authorizationScheme: authorizationScheme as AuthorizationScheme,
    allowedUsers,
    cacheExpirationTime,
  };
}
