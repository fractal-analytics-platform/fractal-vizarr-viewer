import * as path from 'path';
import type { Request } from 'express';
import { getLogger } from './logger.js';
import { Config } from './types';

const logger = getLogger();

export function getValidPath(req: Request, config: Config): string | undefined {
  const requestPath = decodeURIComponent(req.path).normalize();
  if (!config.zarrDataBasePath) {
    return requestPath;
  }
  // Ensure that the selected path is a subfolder of the base data folder
  if (isSubfolder(config.zarrDataBasePath, requestPath)) {
    return requestPath;
  }
  return undefined;
}

/**
 * Ensures that a path to check is a subfolder of a given parent folder.
 */
export function isSubfolder(parentFolder: string, pathToCheck: string): boolean {
  const result = !path.relative(parentFolder, pathToCheck).includes('..');
  if (!result) {
    logger.warn('Path "%s" is not a subfolder of "%s"', pathToCheck, parentFolder);
  }
  return result;
}
