import * as fs from "fs";
import * as fsp from "fs/promises";
import type { Request, Response } from "express";
import type { Ranges, Result as RangeParserResult } from "range-parser";
import { getValidPath } from "./path.js";
import { getLogger } from "./logger.js";
import { Authorizer } from "./authorizer.js";

const logger = getLogger();

let s3: any | null = null;
let s3LoadAttempted = false;

class S3UnavailableError extends Error {
  constructor() {
    super("S3 support is not installed");
    this.name = "S3UnavailableError";
  }
}

async function getS3Client(): Promise<any> {
  if (s3LoadAttempted) {
    if (!s3) throw new S3UnavailableError();
    return s3;
  }
  s3LoadAttempted = true;

  try {
    const moduleName = "@aws-sdk/client-s3" as string;
    const mod: any = await import(moduleName);
    s3 = new mod.S3();
    return s3;
  } catch {
    s3 = null;
    throw new S3UnavailableError();
  }
}

export async function serveZarrData(
  authorizer: Authorizer,
  req: Request,
  res: Response,
) {
  try {
    const completePath = getValidPath(req);
    const is_s3 = completePath.startsWith("s3://");
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
    if (!is_s3) {
      if (!fs.existsSync(completePath)) {
        logger.info("File not found: %s", completePath);
        return res.status(404).send("Not Found").end();
      }
      if (fs.lstatSync(completePath).isDirectory()) {
        logger.info("Path is directory: %s", completePath);
        return res.status(400).send("Is directory").end();
      }
      try {
        await fsp.access(completePath, fs.constants.R_OK);
      } catch {
        logger.error("File is not readable: %s", completePath);
        return res.status(500).send("Internal Server Error").end();
      }
      logger.trace("Path to load: %s", completePath);

      const stats = await fsp.stat(completePath);
      const ranges = req.range(stats.size);
      const options = getRangeOptions(ranges, stats.size, res);

      // if range is invalid, get the whole object and return 416
      const stream = fs.createReadStream(completePath, options);
      stream.on("error", (e) => {
        logger.error("Error reading file: %s, %s", completePath, e);
        if (!res.headersSent) {
          res.status(500).end("Internal Server Error");
        } else {
          res.destroy(e);
        }
      });
      stream.pipe(res);
    } else {
      let s3Client: any;
      try {
        s3Client = await getS3Client();
      } catch (e) {
        if (e instanceof S3UnavailableError) {
          return res
            .status(501)
            .send("Not Implemented - S3 support is not installed.")
            .end();
        }
        throw e;
      }

      // get bucket and key from URI
      let bucket: string = "";
      let key: string = "";
      try {
        const s3Match = completePath.match(/^s3:\/\/([^/]+)\/(.+)$/);
        if (!s3Match) {
          const errorMsg = `Invalid S3 URI format: ${completePath}. Expected format: s3://bucket/key`;
          logger.info(errorMsg);
          return res.status(400).send(errorMsg).end();
        }
        bucket = s3Match[1];
        key = s3Match[2];
      } catch {
        logger.info("Invalid S3 path: %s", completePath);
        return res.status(400).send("Invalid S3 path").end();
      }

      try {
        const s3Response = await s3Client.getObject({
          Bucket: bucket,
          Key: key,
        });
        const objectSize = Number(s3Response.ContentLength);
        const ranges = req.range(objectSize);
        const options = getRangeOptions(ranges, objectSize, res);
        // For range requests, fetch only the requested range from S3
        if (options && "start" in options && "end" in options) {
          const rangeResponse = await s3Client.getObject({
            Bucket: bucket,
            Key: key,
            Range: `bytes=${options.start}-${options.end}`,
          });
          const rangeStream = rangeResponse.Body as NodeJS.ReadableStream;
          rangeStream.pipe(res);
        } else {
          //if range is invalid, get the whole object and returns 416
          const s3Stream = s3Response.Body as NodeJS.ReadableStream;
          s3Stream.pipe(res);
        }
      } catch (s3Error) {
        if (
          s3Error.name === "NoSuchKey" ||
          s3Error.$metadata?.httpStatusCode === 404
        ) {
          logger.info("S3 object not found: %s", completePath);
          return res.status(404).send("Not Found").end();
        }
        if (
          s3Error.name === "AccessDenied" ||
          s3Error.$metadata?.httpStatusCode === 403
        ) {
          logger.error(
            "S3 access denied for %s (bucket=%s, key=%s, requestId=%s); check server S3 credentials/bucket policy",
            completePath,
            bucket,
            key,
            s3Error.$metadata?.requestId,
          );
          return res.status(403).send("Forbidden").end();
        }
        if (s3Error.name === "ExpiredToken") {
          logger.error(
            "S3 credentials expired while fetching %s (requestId=%s); refresh server S3 credentials",
            completePath,
            s3Error.$metadata?.requestId,
          );
          return res.status(401).send("Unauthorized - Expired token").end();
        } else {
          logger.error(
            "Unexpected S3 error for %s (name=%s, statusCode=%s, requestId=%s): %s",
            completePath,
            s3Error.name,
            s3Error.$metadata?.httpStatusCode,
            s3Error.$metadata?.requestId,
            s3Error.message,
          );
          return res.status(500).send("Internal Server Error").end();
        }
      }
    }
  } catch (err) {
    logger.error("Error reading file", err);
    return res.status(500).send("Internal Server Error").end();
  }
}

export function getRangeOptions(
  ranges: Ranges | RangeParserResult | undefined,
  size: number,
  res: Response,
) {
  let options = {};
  if (ranges && Array.isArray(ranges) && ranges.length === 1) {
    const [range] = ranges;
    const { start, end } = range;
    logger.trace("Requested byte range [%d, %d]", start, end);
    if (start >= size || end >= size) {
      // ranges are 0-indexed
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416);
      return options;
    }
    options = { start, end };
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.status(206);
  } else {
    res.setHeader("Content-Length", size);
  }
  return options;
}
