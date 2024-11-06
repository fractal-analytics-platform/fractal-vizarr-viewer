import type { Request, Response } from "express";
import { Config } from "../src/types";
import { vi } from "vitest";

export function mockConfig(config: Partial<Config>) {
  const getConfig = () =>
    ({
      basePath: "/vizarr/",
      fractalServerUrl: "http://localhost:8000",
      zarrDataBasePath: "/path/to/zarr/data",
      ...config,
    } as Config);
  return {
    getConfig,
  };
}

export function getMockedResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn(),
  } as unknown as Response;
}

export function getMockedRequest(
  path: string,
  cookie: string | undefined = undefined
) {
  return {
    path,
    get: () => {
      return cookie;
    },
  } as unknown as Request;
}
