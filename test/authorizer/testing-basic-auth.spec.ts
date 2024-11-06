import { describe, it, expect, vi } from "vitest";
import { mockConfig } from "../mock";
import type { Request } from "express";

vi.mock("../../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "testing-basic-auth",
    testingUsername: "test",
    testingPassword: "password",
  });
});

// Mocking fetch
const fetch = vi.fn();
global.fetch = fetch;

import { getAuthorizer } from "../../src/authorizer.js";
const authorizer = getAuthorizer();

describe("Testing basic auth authorizer", () => {
  it("Missing authorization header", async () => {
    const request = mockAuthHeader(undefined);
    const validUser = await authorizer.isUserValid(request);
    expect(validUser).toBeFalsy();
  });

  it("Invalid authorization header", async () => {
    const request = mockAuthHeader("foo");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized("", request);
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("Non Basic authorization header", async () => {
    const request = mockAuthHeader("Bearer token");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized("", request);
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("Basic authorization header with bad password format", async () => {
    const request = mockAuthHeader("Basic not-base-64");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized("", request);
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("Basic authorization header with invalid password", async () => {
    const request = mockAuthHeader("Basic Zm9vOmJhcg==");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized("", request);
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeFalsy();
  });

  it("Basic authorization header with valid password", async () => {
    const request = mockAuthHeader("Basic dGVzdDpwYXNzd29yZA==");
    const validUser = await authorizer.isUserValid(request);
    const authorizedUser = await authorizer.isUserAuthorized("", request);
    expect(validUser).toBeTruthy();
    expect(authorizedUser).toBeTruthy();
  });
});

function mockAuthHeader(header: string | undefined) {
  return {
    get: () => {
      return header;
    },
  } as unknown as Request;
}
