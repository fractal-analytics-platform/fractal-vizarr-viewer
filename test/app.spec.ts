import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getMockedResponse, getMockedRequest, mockConfig } from "./mock";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "fractal-server",
  });
});

import { serveZarrData } from "../src/data";
import { Authorizer } from "../src/authorizer";

describe("Serving vizarr data", () => {
  const tmpDir = path.join(os.tmpdir(), "fractal-vizarr-app-test");

  beforeAll(() => {
    // Create test files
    fs.mkdirSync(path.join(tmpDir, "directory"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("Invalid path request", async () => {
    const request = getMockedRequest(`${tmpDir}/../invalid/path`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("Unauthorized request", async () => {
    const request = getMockedRequest(`${tmpDir}/test1`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(false, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("Forbidden request", async () => {
    const request = getMockedRequest(`${tmpDir}/test1`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, false);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("File not found", async () => {
    const request = getMockedRequest(`${tmpDir}/test2`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("File is directory", async () => {
    const request = getMockedRequest(`${tmpDir}/directory`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(400);
  });
});

function mockAuthorizer(valid: boolean, authorized: boolean): Authorizer {
  return {
    async isUserValid() {
      return valid;
    },
    async isUserAuthorized() {
      return authorized;
    },
  };
}
