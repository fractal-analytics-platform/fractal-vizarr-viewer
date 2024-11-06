import express from "express";
import { getLogger } from "./logger.js";
import { getConfig } from "./config.js";
import { serveZarrData } from "./data.js";
import { getAuthorizer } from "./authorizer.js";

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
  await serveZarrData(authorizer, req, res);
});

// Serving Vizarr static files
app.use(`${config.basePath}`, express.static(config.vizarrStaticFilesPath));

// Start server
const server = app.listen(config.port, () => {
  logger.info(
    "fractal-vizarr-viewer is listening at http://localhost:%d%s",
    config.port,
    config.basePath
  );
});

for (const signal of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
  process.on(signal, (signal) => {
    logger.info("Process received a %s signal", signal);
    server.close();
  });
}
