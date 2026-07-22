import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { getVersion } from "../src/version";

describe("getVersion", () => {
  it("returns the version declared in package.json", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
    expect(getVersion()).toBe(packageJson.version);
  });
});
