import { describe, it, beforeEach, expect, vi } from "vitest";
import {
  getMockedRequestWithToken,
  getMockedRequestWithCookie,
  mockConfig,
  getAnonymousMockedRequest,
} from "../mock";

vi.mock("../../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "fractal-server",
  });
});

// Mocking fetch
const fetch = vi.fn();
global.fetch = fetch;

import { getAuthorizer } from "../../src/authorizer.js";
const authorizer = getAuthorizer();

describe("Viewer paths authorizer", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it("Allowed user with valid path in zarr directory list", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => resolve({ email: "admin@example.com" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) =>
            resolve([
              "/path/to/project",
              "/path/to/zarr/data/foo",
              "/path/to/zarr/data/bar",
            ])
          ),
      });
    const request = getMockedRequestWithCookie(
      "/path/to/zarr/data/foo/xxx",
      "token-user-1"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/foo/xxx",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });

  it("Allowed user with valid path in zarr project dir", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => resolve({ email: "user2@example.com" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) =>
            resolve(["/path/to/project", "/path/to/zarr/data/bar"])
          ),
      });
    const request = getMockedRequestWithToken(
      "/path/to/project/xxx",
      "token-user-2"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/project/xxx",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });

  it("Allowed user with forbidden path", async () => {
    const request = getMockedRequestWithToken(
      "/path/to/forbidden",
      "token-user-1"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/forbidden",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("Anonymous user with valid path", async () => {
    const request = getAnonymousMockedRequest("/path/to/zarr/data/foo/xxx");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/foo/xxx",
      request
    );
    expect(validUser).toBeFalsy();
    expect(authorizedUser).toBeFalsy();
  });

  it("/auth/current-user/allowed-viewer-paths/ returns error", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => resolve({ email: "user3@example.com" })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => new Promise((resolve) => resolve({ detail: "error" })),
      });
    const request = getMockedRequestWithCookie(
      "/path/to/zarr/data/foo/xxx",
      "token-user-3"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/foo/xxx",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });
});
