import type { Request, Response } from "express";
import { Config } from "../src/types";
import { vi } from "vitest";
import { Writable } from "node:stream";

export function mockConfig(config: Partial<Config>) {
  const getConfig = () =>
    ({
      basePath: "/data",
      fractalServerUrl: "http://localhost:8000",
      ...config,
    }) as Config;
  return {
    getConfig,
  };
}

class MockResponse extends Writable {
  body = "";
  status = vi.fn().mockReturnThis();
  send = vi.fn().mockReturnThis();
  setHeader = vi.fn();
  end = vi.fn();

  _write(
    chunk: any,
    _: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.body += chunk.toString();
    callback(); // Indicate the write is complete
  }
}

export function getMockedResponse() {
  const res = new MockResponse();
  return res as unknown as Response & { body: string };
}

export function getAnonymousMockedRequest(path: string) {
  return {
    path,
    get: () => {},
    range: () => undefined,
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
    range: () => undefined,
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
    range: () => undefined,
  } as unknown as Request;
}

export function getMockedRequestWithRange(
  path: string,
  value: { start: number; end: number } | undefined,
) {
  const rangeHeader = value
    ? `bytes=${value.start}-${value.end}`
    : undefined;
  return {
    path,
    headers: rangeHeader ? { range: rangeHeader } : {},
    range: () => [value],
  } as unknown as Request;
}
