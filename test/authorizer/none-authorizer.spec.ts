import { describe, it, expect, vi } from "vitest";
import { getAnonymousMockedRequest, mockConfig } from "../mock";

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
  it("Valid path", async () => {
    const request = getAnonymousMockedRequest("/valid/path");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/valid/path",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });

  it("Invalid path", async () => {
    const request = getAnonymousMockedRequest("/valid/path");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized(
      "/invalid/path",
      request
    );
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });
});
