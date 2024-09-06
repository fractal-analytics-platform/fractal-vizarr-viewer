import express from 'express';
import * as fs from 'fs';
import { getLogger } from './logger.js';
import { getConfig } from './config.js';
import { getAuthorizer } from './authorizer.js';

const config = getConfig();
const logger = getLogger();

// Defining Express application
const app = express();

// Log each request
app.use((req, _, next) => {
  logger.debug("%s - %s", req.method, req.path.normalize());
  next();
});

const authorizer = getAuthorizer();

// Endpoint serving zarr files
app.use(`${config.basePath}data`, async function (req, res) {
  try {
    const authorizedPath = await authorizer.getAuthorizedPath(req);
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
