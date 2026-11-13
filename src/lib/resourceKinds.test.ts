import { describe, expect, it } from "vitest";
import { kindNamed } from "./resourceKinds";

describe("kindNamed", () => {
  it("recognises mercury, water and fuel in English, French and Arabic", () => {
    expect(kindNamed("MERCURY")).toBe("mercury");
    expect(kindNamed("زئبق")).toBe("mercury");
    expect(kindNamed("  الماء ")).toBe("water");
    expect(kindNamed("الزِّئبق")).toBe("mercury");
    expect(kindNamed("Mércure")).toBe("mercury");
    expect(kindNamed("Gasoil")).toBe("fuel");
    expect(kindNamed("Chaux")).toBeUndefined();
    expect(kindNamed("Mercure 2")).toBeUndefined();
  });
});
