import { describe, it, expect } from "vitest";
import { defineSchema } from "./schema";

describe("defineSchema", () => {
  it("returns the input unchanged", () => {
    const s = defineSchema({
      sections: [
        {
          title: "T",
          fields: [{ key: "k", kind: "number", label: "L" }],
        },
      ],
    });
    expect(s.sections.length).toBe(1);
    expect(s.sections[0].fields[0].key).toBe("k");
  });

  it("infers field kind discriminant", () => {
    const s = defineSchema({
      sections: [
        {
          title: "T",
          fields: [
            { key: "n", kind: "number", label: "N", min: 0, max: 100 },
            { key: "t", kind: "toggle", label: "T" },
            { key: "s", kind: "select", label: "S", options: [{ value: "a", label: "A" }] },
          ],
        },
      ],
    });
    expect(s.sections[0].fields[0].kind).toBe("number");
    expect(s.sections[0].fields[1].kind).toBe("toggle");
    expect(s.sections[0].fields[2].kind).toBe("select");
  });
});
