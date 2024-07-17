import express from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv'

// Loading envirnment variables
dotenv.config();

const FRACTAL_SERVER_URL = process.env.FRACTAL_SERVER_URL;
const ZARR_DATA_BASE_PATH = process.env.ZARR_DATA_BASE_PATH;
const VIZARR_STATIC_FILES_PATH = process.env.VIZARR_STATIC_FILES_PATH;

if (!FRACTAL_SERVER_URL || !ZARR_DATA_BASE_PATH || !VIZARR_STATIC_FILES_PATH) {
  console.error('Missing environment variable. Check the .env file');
  process.exit(1);
}

// Defining Express application
const app = express();
const port = 3000;

// Endpoint serving users files
app.use('/data', async function (req, res) {
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
  const user = await getUserFromCookie(cookie);
  if (!user || !user.is_superuser) {
    // Only superusers can access fractal-data
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

async function getUserFromCookie(cookie: string): Promise<{ username: string, is_superuser: boolean } | undefined> {
  const response = await fetch(`${FRACTAL_SERVER_URL}/auth/current-user/`, {
    headers: {
      'Cookie': cookie
    }
  });
  if (response.ok) {
    return await response.json();
  }
  return undefined;
}

// Serving Vizarr static files
app.use('/', express.static(VIZARR_STATIC_FILES_PATH));

// Start server
app.listen(port, () => {
  return console.log(`fractal-data is listening at http://localhost:${port}`);
});
