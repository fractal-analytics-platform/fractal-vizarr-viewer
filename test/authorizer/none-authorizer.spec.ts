import { describe, it, beforeEach, expect, vi } from "vitest";
import { getMockedRequest, mockConfig } from "./authorizer-mocks.js";

vi.mock("../../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "none",
  });
});

// Mocking fetch
const fetch = vi.fn();
global.fetch = fetch;

import { getAuthorizer } from "../../src/authorizer.js";
const authorizer = getAuthorizer();

describe("None authorizer", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it("Registered user with valid absolute path", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        new Promise((resolve) => resolve({ email: "admin@example.com" })),
    });
    const request = getMockedRequest(
      "/path/to/zarr/data/foo/bar",
      "cookie-user-1"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq("/path/to/zarr/data/foo/bar");
  });

  it("Allowed user with invalid path", async () => {
    const request = getMockedRequest("../foo/bar", "cookie-user-1");
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("Path with URL encoded characters", async () => {
    const request = getMockedRequest(
      "/path/to/zarr/data/foo/bar%23baz",
      undefined
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq("/path/to/zarr/data/foo/bar#baz");
  });
});
