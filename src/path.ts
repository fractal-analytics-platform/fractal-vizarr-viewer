import * as path from 'path';
import type { Request } from 'express';
import { getLogger } from './logger.js';

const logger = getLogger();

export function getValidPath(req: Request): string {
  return decodeURIComponent(req.path).normalize();
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
