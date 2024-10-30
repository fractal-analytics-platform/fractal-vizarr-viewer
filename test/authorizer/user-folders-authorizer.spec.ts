import { describe, it, expect, vi } from "vitest";
import { getMockedRequest, mockConfig } from "./authorizer-mocks.js";

vi.mock("../../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "user-folders",
  });
});

// Mocking fetch
const fetch = vi.fn();
global.fetch = fetch;

import { getAuthorizer } from "../../src/authorizer.js";
const authorizer = getAuthorizer();

describe("User folders authorizer", () => {
  it("Registered user1 with valid absolute path", async () => {
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
        json: () => new Promise((resolve) => resolve({ slurm_user: "admin" })),
      });
    const request = getMockedRequest(
      "/path/to/zarr/data/admin/foo/bar",
      "cookie-user-1"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq("/path/to/zarr/data/admin/foo/bar");
  });

  it("Registered user with path of another user", async () => {
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
        json: () => new Promise((resolve) => resolve({ slurm_user: "user2" })),
      });
    const request = getMockedRequest(
      "/path/to/zarr/data/admin/foo/bar",
      "cookie-user-2"
    );
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("Registered user with invalid path", async () => {
    const request = getMockedRequest("../foo/bar", "cookie-user-1");
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it("/auth/current-user/settings/ returns error", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    const request = getMockedRequest("/user2/foo/bar", "cookie-user-3");
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
