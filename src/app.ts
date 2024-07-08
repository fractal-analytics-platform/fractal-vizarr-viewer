import express from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv'

// Loading envirnment variables
dotenv.config();

const FRACTAL_SERVER_URL = process.env.FRACTAL_SERVER_URL;
const USERS_DATA_BASE_PATH = process.env.USERS_DATA_BASE_PATH;
const VIZARR_STATIC_FILES_PATH = process.env.VIZARR_STATIC_FILES_PATH;

if (!FRACTAL_SERVER_URL || !USERS_DATA_BASE_PATH || !VIZARR_STATIC_FILES_PATH) {
  console.error('Missing environment variable. Check the .env file');
  process.exit(1);
}

// Defining Express application
const app = express();
const port = 3000;

// Endpoint serving users files
app.use('/users', async function (req, res) {
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
});

// Returns the requested file path if authorized, undefined otherwise
async function getAuthorizedPath(req: Request): Promise<string | undefined> {
  const requestPath = req.path;
  return requestPath;
  // const cookie = req.get('Cookie');
  // const username = await getUserFromCookie(cookie);
  // // Check if the first segment of the requested path matches with the username
  // const matches = requestPath.match(/^\/([^/]*)\/.*$/);
  // if (username && matches && matches.length > 1 && matches[1] === username) {
  //   const userFolder = path.join(USERS_DATA_BASE_PATH, username);
  //   const completePath = path.join(USERS_DATA_BASE_PATH, requestPath).normalize();
  //   // Ensure that the selected path is a subfolder of the user folder
  //   if (path.relative(userFolder, completePath).includes('..')) {
  //     return undefined;
  //   }
  //   console.log(completePath);
  //   return completePath;
  // }
  // return undefined;
}

async function getUserFromCookie(cookie: string): Promise<string | undefined> {
  const response = await fetch(`${FRACTAL_SERVER_URL}/auth/current-user/`, {
    headers: {
      'Cookie': cookie
    }
  });
  if (response.ok) {
    const { username } = await response.json();
    return username;
  }
  return undefined;
}

// Serving Vizarr static files
app.use('/', express.static(VIZARR_STATIC_FILES_PATH));

// Start server
app.listen(port, () => {
  return console.log(`fractal-data is listening at http://localhost:${port}`);
});
