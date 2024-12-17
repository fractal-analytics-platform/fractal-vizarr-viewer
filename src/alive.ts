import type { Request, Response } from "express";
import { createRequire } from "module";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";

const config = getConfig();
const logger = getLogger();

export async function aliveEndpoint(_: Request, res: Response) {

  // reading version from package.json
  const require = createRequire(import.meta.url);
  const { version } = require("../package.json");

  // retrieving server status
  let fractal_server_alive = false;
  let fractal_server_version: string | null = null;

  try {
    const response = await fetch(`${config.fractalServerUrl}/api/alive/`);
    if (response.ok) {
      const { alive, version } = await response.json();
      fractal_server_alive = alive;
      fractal_server_version = version;
    }
  } catch {
    logger.error("Error reading fractal-server alive endpoint");
  }

  res.json({ alive: true, version, fractal_server_alive, fractal_server_version }).end();
}
