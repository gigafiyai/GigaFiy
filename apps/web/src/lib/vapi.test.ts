import { describe, it, expect, afterEach } from "vitest";
import { toE164, vapiConfigured } from "./vapi";

describe("toE164", () => {
  it("normalizes a 10-digit US number", () => {
    expect(toE164("(617) 299-2300")).toBe("+16172992300");
    expect(toE164("617-299-2300")).toBe("+16172992300");
  });
  it("normalizes an 11-digit number starting with 1", () => {
    expect(toE164("16172992300")).toBe("+16172992300");
  });
  it("preserves an explicit international number", () => {
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("returns null for empty or unparseable input", () => {
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164("12345")).toBeNull();
  });
});

describe("vapiConfigured", () => {
  const original = { key: process.env.VAPI_API_KEY, num: process.env.VAPI_PHONE_NUMBER_ID };
  afterEach(() => {
    process.env.VAPI_API_KEY = original.key;
    process.env.VAPI_PHONE_NUMBER_ID = original.num;
  });

  it("is false without both keys", () => {
    delete process.env.VAPI_API_KEY;
    delete process.env.VAPI_PHONE_NUMBER_ID;
    expect(vapiConfigured()).toBe(false);
  });
  it("is true when both are set", () => {
    process.env.VAPI_API_KEY = "k";
    process.env.VAPI_PHONE_NUMBER_ID = "p";
    expect(vapiConfigured()).toBe(true);
  });
});
