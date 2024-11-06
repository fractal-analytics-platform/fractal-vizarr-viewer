import * as fs from "fs";
import type { Request, Response } from "express";
import { getValidPath } from "./path.js";
import { getConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { Authorizer } from "./authorizer.js";

const config = getConfig();
const logger = getLogger();

export async function serveZarrData(
  authorizer: Authorizer,
  req: Request,
  res: Response
) {
  try {
    const completePath = getValidPath(req, config);
    if (!completePath) {
      logger.info("Invalid path: %s", req.path.normalize());
      return res.status(404).send("Not Found").end();
    }
    const validUser = await authorizer.isUserValid(req);
    if (!validUser) {
      logger.info("Unauthorized request: %s", req.path.normalize());
      return res.status(401).send("Unauthorized").end();
    }
    const authorized = await authorizer.isUserAuthorized(completePath, req);
    if (!authorized) {
      logger.info("Forbidden request: %s", req.path.normalize());
      return res.status(403).send("Forbidden").end();
    }
    if (!fs.existsSync(completePath)) {
      logger.info("File not found: %s", completePath);
      return res.status(404).send("Not Found").end();
    }
    if (fs.lstatSync(completePath).isDirectory()) {
      logger.info("Path is directory: %s", completePath);
      return res.status(400).send("Is directory").end();
    }
    logger.trace("Path to load: %s", completePath);
    const stream = fs.createReadStream(completePath);
    stream.pipe(res);
  } catch (err) {
    logger.error("Error reading file", err);
    return res.status(500).send("Internal Server Error").end();
  }
}
