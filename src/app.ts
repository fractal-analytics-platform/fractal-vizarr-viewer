import express from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv'
import { caching } from 'cache-manager';
// Needed for node 16
import fetch from 'node-fetch';

// Loading envirnment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const FRACTAL_SERVER_URL = process.env.FRACTAL_SERVER_URL;
const ZARR_DATA_BASE_PATH = process.env.ZARR_DATA_BASE_PATH;
const VIZARR_STATIC_FILES_PATH = process.env.VIZARR_STATIC_FILES_PATH;
const ALLOWED_USERS = process.env.ALLOWED_USERS;
// Cookie cache TTL in seconds
const CACHE_EXPIRATION_TIME = process.env.CACHE_EXPIRATION_TIME ? parseInt(process.env.CACHE_EXPIRATION_TIME) : 60;

if (!FRACTAL_SERVER_URL || !ZARR_DATA_BASE_PATH || !VIZARR_STATIC_FILES_PATH || !ALLOWED_USERS) {
  console.error('Missing environment variable. Check the .env file');
  process.exit(1);
}

let basePath = process.env.BASE_PATH || '/vizarr';
if (!basePath.endsWith('/')) {
  basePath += '/';
}

if (!fs.existsSync(ALLOWED_USERS)) {
  console.error(`Allowed users file not found: ${ALLOWED_USERS}`);
  process.exit(1);
}

const allowedUsersData = fs.readFileSync(ALLOWED_USERS).toString();
const allowedUsers = allowedUsersData.split('\n').map(n => n.trim()).filter(n => !!n);

// Defining Express application
const app = express();
const port = PORT;

const cookiesCache = await caching('memory', {
  ttl: CACHE_EXPIRATION_TIME * 1000 // milliseconds
});

// Endpoint serving zarr files
app.use(`${basePath}data`, async function (req, res) {
  try {
    const authorizedPath = await getAuthorizedPath(req);
    if (!authorizedPath) {
      return res.status(403).send('Forbidden').end();
    }
    if (!fs.existsSync(authorizedPath)) {
      return res.status(404).send('Not Found').end();
    }
    if (fs.lstatSync(authorizedPath).isDirectory()) {
      return res.status(400).send('Is directory').end();
    }
    const stream = fs.createReadStream(authorizedPath);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error').end();
  }
});

// Returns the requested file path if authorized, undefined otherwise
async function getAuthorizedPath(req: Request): Promise<string | undefined> {
  const requestPath = req.path.normalize();
  const cookie = req.get('Cookie');
  if (!cookie) {
    return undefined;
  }
  const user = await getUserFromCookie(cookie);
  if (!user || !allowedUsers.includes(user.email)) {
    // Only allowed users can access fractal-data
    return undefined;
  }
  const completePath = requestPath.startsWith(ZARR_DATA_BASE_PATH) ?
    requestPath : path.join(ZARR_DATA_BASE_PATH, requestPath);
  // Ensure that the selected path is a subfolder of the base data folder
  if (path.relative(ZARR_DATA_BASE_PATH, completePath).includes('..')) {
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
      const response = await fetch(`${FRACTAL_SERVER_URL}/auth/current-user/`, {
        headers: {
          'Cookie': cookie
        }
      });
      if (response.ok) {
        user = await response.json();
        cookiesCache.set(cookie, JSON.stringify(user));
      }
    }
  } finally {
    loadingCookies = loadingCookies.filter(c => c !== cookie);
  }
  return user;
}

// Serving Vizarr static files
app.use(`${basePath}`, express.static(VIZARR_STATIC_FILES_PATH));

// Start server
app.listen(port, () => {
  return console.log(`fractal-data is listening at http://localhost:${port}${basePath}`);
});
