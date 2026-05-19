import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
  passwordStrengthMessage,
} from "@/lib/passwordPolicy";
import { checkPassword } from "@/lib/passwordSecurity";

describe("getPasswordCompositionFailure", () => {
  it("flags missing uppercase", () => {
    expect(getPasswordCompositionFailure("lowercase12345")).toBe(
      "missing_uppercase"
    );
  });

  it("flags missing digit", () => {
    expect(getPasswordCompositionFailure("OnlyUpperCase")).toBe(
      "missing_digit"
    );
  });

  it("returns null when satisfied", () => {
    expect(getPasswordCompositionFailure("ValidPassPhrase9")).toBeNull();
  });
});

describe("passwordStrengthMessage", () => {
  it("includes requirements for too_short", () => {
    const msg = passwordStrengthMessage({ ok: false, reason: "too_short" });
    expect(msg).toContain(String(PASSWORD_MIN_LENGTH));
  });
});

describe("checkPassword", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects short passwords", async () => {
    const r = await checkPassword("Short1A");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too_short");
  });

  it("rejects missing uppercase", async () => {
    const r = await checkPassword("lowercaseonly123");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_uppercase");
  });

  it("rejects missing digit", async () => {
    const r = await checkPassword("ONLYUPPERCASELETTERS");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_digit");
  });

  it("accepts a long unpredictable password when not pwned", async () => {
    const pw =
      "ZebraQuartzMountain9RiverValley!HarvestTwentyOneUniqueSalt2026";
    const r = await checkPassword(pw, []);
    expect(r.ok).toBe(true);
  });
});
