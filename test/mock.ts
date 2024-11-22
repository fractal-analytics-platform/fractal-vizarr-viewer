import type { Request, Response } from "express";
import { Config } from "../src/types";
import { vi } from "vitest";

export function mockConfig(config: Partial<Config>) {
  const getConfig = () =>
    ({
      basePath: "/vizarr/",
      fractalServerUrl: "http://localhost:8000",
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

export function getAnonymousMockedRequest(path: string) {
  return {
    path,
    get: () => {},
  } as unknown as Request;
}

export function getMockedRequestWithToken(path: string, token: string) {
  return {
    path,
    get: (key: string) => {
      if (key === "Authorization") {
        return `Bearer ${token}`;
      }
    },
  } as unknown as Request;
}

export function getMockedRequestWithCookie(path: string, token: string) {
  return {
    path,
    get: (key: string) => {
      if (key === "Cookie") {
        return `fastapiusersauth=${token}`;
      }
    },
  } as unknown as Request;
}
