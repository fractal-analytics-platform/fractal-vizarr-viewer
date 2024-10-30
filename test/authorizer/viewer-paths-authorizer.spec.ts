import { describe, it, beforeEach, expect, vi } from "vitest";
import { getMockedRequest, mockConfig } from "./authorizer-mocks.js";

vi.mock("../../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "fractal-server-viewer-paths",
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

  it("Allowed user with valid path", async () => {
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
            resolve(["/path/to/zarr/data/foo", "/path/to/zarr/data/bar"])
          ),
      });
    const request = getMockedRequest(
      "/path/to/zarr/data/foo/xxx",
      "cookie-user-1"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq("/path/to/zarr/data/foo/xxx");
  });

  it("Allowed user with forbidden path", async () => {
    const request = getMockedRequest("/path/to/forbidden", "cookie-user-1");
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("Allowed user with forbidden relative path", async () => {
    const request = getMockedRequest(
      "/path/to/zarr/data/foo/xxx/../../forbidden",
      "cookie-user-1"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("Anonymous user with valid path", async () => {
    const request = getMockedRequest("/path/to/zarr/data/foo/xxx", undefined);
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("/auth/current-user/viewer-paths/ returns error", async () => {
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
    const request = getMockedRequest(
      "/path/to/zarr/data/foo/xxx",
      "cookie-user-3"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
