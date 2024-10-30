import type { Request } from "express";
import { Config } from "../../src/types";

export function mockConfig(config: Partial<Config>) {
  const getConfig = () => ({
    fractalServerUrl: "http://localhost:8000",
    zarrDataBasePath: "/path/to/zarr/data",
    authorizationScheme: config.authorizationScheme,
  });
  return {
    getConfig,
  };
}

export function getMockedRequest(path: string, cookie: string | undefined) {
  return {
    path,
    get: () => {
      return cookie;
    },
  } as unknown as Request;
}
