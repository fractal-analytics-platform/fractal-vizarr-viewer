import { describe, it, expect } from "vitest";
import { getAnonymousMockedRequest } from "./mock";
import { getValidPath, isSubfolder } from "../src/path";

describe("Path utilities", () => {
  it("isSubfolder", () => {
    expect(isSubfolder("/path/to/parent", "/path/to/parent/child")).toBeTruthy();
    expect(isSubfolder("/path/to/parent", "/another/path")).toBeFalsy();
    expect(isSubfolder("/path/to/parent", "/path/to/parent/../other")).toBeFalsy();
  });

  it("valid path with URL encoded characters", async () => {
    const request = getAnonymousMockedRequest("/path/to/bar%23baz");
    const path = getValidPath(request);
    expect(path).toEqual("/path/to/bar#baz");
  });
});
