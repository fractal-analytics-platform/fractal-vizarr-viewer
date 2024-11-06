import { describe, it, expect } from "vitest";
import { getMockedRequest, mockConfig } from "./mock";
import { getValidPath } from "../src/path";

describe("Path utilities", () => {
  it("valid path with URL encoded characters - no zarrDataBasePath", async () => {
    const { getConfig } = mockConfig({ zarrDataBasePath: null });
    const config = getConfig();
    const request = getMockedRequest("/path/to/bar%23baz");
    const path = getValidPath(request, config);
    expect(path).toEqual("/path/to/bar#baz");
  });

  it("valid path with zarrDataBasePath", async () => {
    const { getConfig } = mockConfig({ zarrDataBasePath: "/base/zarr/path" });
    const config = getConfig();
    const request = getMockedRequest("/base/zarr/path/valid");
    const path = getValidPath(request, config);
    expect(path).toEqual("/base/zarr/path/valid");
  });

  it("invalid path with zarrDataBasePath", async () => {
    const { getConfig } = mockConfig({ zarrDataBasePath: "/base/zarr/path" });
    const config = getConfig();
    const request = getMockedRequest("/base/zarr/path/../invalid");
    const path = getValidPath(request, config);
    expect(path).toEqual(undefined);
  });
});
