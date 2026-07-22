import express from "express";
import { getLogger } from "./logger.js";
import { getConfig } from "./config.js";
import { serveZarrData } from "./data.js";
import { getAuthorizer } from "./authorizer.js";
import { aliveEndpoint } from "./alive.js";
import { getVersion } from "./version.js";

const logger = getLogger();
logger.info("fractal-data version %s", getVersion());

const config = getConfig();

// Defining Express application
const app = express();

// Log each request
app.use((req, _, next) => {
  logger.debug("%s - %s", req.method, req.path.normalize());
  next();
});

const authorizer = getAuthorizer();

// Endpoint serving zarr files
app.use(`${config.basePath}files`, async function (req, res) {
  await serveZarrData(authorizer, req, res);
});

// Alive endpoint
app.use(`${config.basePath}alive`, async function (req, res) {
  await aliveEndpoint(req, res);
});

// Serving Vizarr static files
if (config.vizarrStaticFilesPath) {
  app.use(
    `${config.basePath}vizarr`,
    express.static(config.vizarrStaticFilesPath),
  );
}

// Start server
const server = app.listen(config.port, config.bindAddress, () => {
  logger.info(
    "fractal-data is listening at http://localhost:%d%s",
    config.port,
    config.basePath,
  );
});

for (const signal of ["SIGINT", "SIGTERM", "SIGQUIT"]) {
  process.on(signal, (signal) => {
    logger.info("Process received a %s signal", signal);
    server.close();
  });
}
