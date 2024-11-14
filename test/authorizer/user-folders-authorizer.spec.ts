import { describe, it, expect, vi, beforeEach } from "vitest";
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
  beforeEach(() => {
    fetch.mockClear();
  });

  it("Registered user with valid absolute path based on slurm_user", async () => {
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
            resolve({
              slurm_user: "admin",
              project_dir: "/path/to/project",
            })
          ),
      });
    const request = getMockedRequest(
      "/path/to/zarr/data/admin/foo/bar",
      "cookie-admin-1"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/admin/foo/bar",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });

  it("Registered user with valid absolute path based on project_dir", async () => {
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
            resolve({
              slurm_user: "admin",
              project_dir: "/path/to/project",
            })
          ),
      });
    const request = getMockedRequest(
      "/path/to/project/foo/bar",
      "cookie-admin-2"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/project/foo/bar",
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

  it("Registered user without slurm_user", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => resolve({ email: "user4@example.com" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => new Promise((resolve) => resolve({ slurm_user: null })),
      });
    const request = getMockedRequest(
      "/path/to/zarr/data/user4/foo/bar",
      "cookie-user-4"
    );
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/path/to/zarr/data/user4/foo/bar",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });
});
