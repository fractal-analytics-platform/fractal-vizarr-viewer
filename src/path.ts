import * as path from 'path';
import type { Request } from 'express';

export function getValidPath(req: Request): string {
  return decodeURIComponent(req.path).normalize();
}

/**
 * Ensures that a path to check is a subfolder of a given parent folder.
 */
export function isSubfolder(parentFolder: string, pathToCheck: string): boolean {
  return !path.relative(parentFolder, pathToCheck).includes('..');
}
