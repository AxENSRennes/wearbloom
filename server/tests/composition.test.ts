import { describe, expect, test } from "bun:test";
import { validateComposition } from "../src/domain/composition";

describe("look composition", () => {
  test("allows top, bottom, and optional outerwear", () => {
    expect(() =>
      validateComposition([
        { id: crypto.randomUUID(), category: "top" },
        { id: crypto.randomUUID(), category: "bottom" },
        { id: crypto.randomUUID(), category: "outerwear" },
      ]),
    ).not.toThrow();
  });

  test("allows a dress with outerwear", () => {
    expect(() =>
      validateComposition([
        { id: crypto.randomUUID(), category: "dress" },
        { id: crypto.randomUUID(), category: "outerwear" },
      ]),
    ).not.toThrow();
  });

  test("rejects dress with top or bottom", () => {
    expect(() =>
      validateComposition([
        { id: crypto.randomUUID(), category: "dress" },
        { id: crypto.randomUUID(), category: "top" },
      ]),
    ).toThrow("LOOK_DRESS_CONFLICT");
  });

  test("rejects duplicate categories", () => {
    expect(() =>
      validateComposition([
        { id: crypto.randomUUID(), category: "top" },
        { id: crypto.randomUUID(), category: "top" },
      ]),
    ).toThrow("LOOK_DUPLICATE_CATEGORY");
  });

  test("rejects an isolated garment", () => {
    expect(() => validateComposition([{ id: crypto.randomUUID(), category: "top" }])).toThrow("LOOK_INCOMPLETE");
    expect(() => validateComposition([{ id: crypto.randomUUID(), category: "outerwear" }])).toThrow("LOOK_INCOMPLETE");
  });
});
