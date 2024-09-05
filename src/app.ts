import express from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { caching } from 'cache-manager';
// Needed for node 16
import fetch from 'node-fetch';
import { getLogger } from './logger.js';
import { getConfig } from './config.js';

// Loading configuration from environment variables
const config = getConfig();

const logger = getLogger();

// Defining Express application
const app = express();

const cookiesCache = await caching('memory', {
  ttl: config.cacheExpirationTime * 1000 // milliseconds
});

// Log each request
app.use((req, _, next) => {
  logger.debug("%s - %s", req.method, req.path.normalize());
  next();
});

// Endpoint serving zarr files
app.use(`${config.basePath}data`, async function (req, res) {
  try {
    const authorizedPath = await getAuthorizedPath(req);
    if (!authorizedPath) {
      logger.info("Forbidden request: %s", req.path.normalize());
      return res.status(403).send('Forbidden').end();
    }
    if (!fs.existsSync(authorizedPath)) {
      logger.info("File not found: %s", authorizedPath);
      return res.status(404).send('Not Found').end();
    }
    if (fs.lstatSync(authorizedPath).isDirectory()) {
      logger.info("Path is directory: %s", authorizedPath);
      return res.status(400).send('Is directory').end();
    }
    const stream = fs.createReadStream(authorizedPath);
    stream.pipe(res);
  } catch (err) {
    logger.error('Error reading file', err);
    return res.status(500).send('Internal Server Error').end();
  }
});

// Returns the requested file path if authorized, undefined otherwise
async function getAuthorizedPath(req: Request): Promise<string | undefined> {
  const requestPath = req.path.normalize();
  const cookie = req.get('Cookie');
  if (!cookie) {
    logger.debug("Missing cookie header");
    return undefined;
  }
  const user = await getUserFromCookie(cookie);
  if (!user || !config.allowedUsers.includes(user.email)) {
    // Only allowed users can access fractal-vizarr-viewer
    logger.debug("User is not in the list of allowed users");
    return undefined;
  }
  const completePath = requestPath.startsWith(config.zarrDataBasePath) ?
    requestPath : path.join(config.zarrDataBasePath, requestPath);
  logger.trace("Path to load: %s", completePath);
  // Ensure that the selected path is a subfolder of the base data folder
  if (path.relative(config.zarrDataBasePath, completePath).includes('..')) {
    logger.warn("Path %s is not a subfolder of the base data folder", completePath);
    return undefined;
  }
  return completePath;
}

// Track the cookies for which we are retrieving the user info from fractal-server
// Used to avoid querying the cache while the fetch call is in progress
let loadingCookies: string[] = [];

async function getUserFromCookie(cookie: string): Promise<{ email: string } | undefined> {
  while (loadingCookies.includes(cookie)) {
    // a fetch call for this cookie is in progress; wait for its completion
    await new Promise(r => setTimeout(r));
  }
  loadingCookies.push(cookie);
  let user = undefined;
  try {
    const value: string = await cookiesCache.get(cookie);
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
        user = await response.json();
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

// Serving Vizarr static files
app.use(`${config.basePath}`, express.static(config.vizarrStaticFilesPath));

// Start server
const server = app.listen(config.port, () => {
  logger.info('fractal-vizarr-viewer is listening at http://localhost:%d%s', config.port, config.basePath)
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGQUIT']) {
  process.on(signal, (signal) => {
    logger.info('Process received a %s signal', signal);
    server.close();
  });
}
