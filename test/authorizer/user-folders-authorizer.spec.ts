import { describe, it, expect, vi } from "vitest";
import { getMockedRequest, mockConfig } from "../mock";

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
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/admin/foo/bar",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
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
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/admin/foo/bar",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("/auth/current-user/settings/ returns error", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => resolve({ email: "user3@example.com" })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
    const request = getMockedRequest("/user2/foo/bar", "cookie-user-3");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/user2/foo/bar",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });
});
