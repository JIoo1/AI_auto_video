import { describe, expect, it } from "vitest";
import { fingerprint } from "./pipeline-cache.js";

describe("pipeline cache fingerprints", () => {
  it("is stable for equivalent values and changes when inputs change", () => {
    expect(fingerprint({ text: "SEO", speed: 1 })).toBe(
      fingerprint({ text: "SEO", speed: 1 }),
    );
    expect(fingerprint({ text: "SEO", speed: 1 })).not.toBe(
      fingerprint({ text: "SEO khác", speed: 1 }),
    );
  });
});
