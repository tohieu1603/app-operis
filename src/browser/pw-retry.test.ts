import { describe, expect, it } from "vitest";
import { isTransientPlaywrightError, withTransientRetry } from "./pw-retry.js";

describe("isTransientPlaywrightError", () => {
  it("returns true for element not visible", () => {
    expect(isTransientPlaywrightError(new Error("element not visible"))).toBe(true);
  });

  it("returns true for element not attached", () => {
    expect(isTransientPlaywrightError(new Error("Element is not attached to the DOM"))).toBe(true);
  });

  it("returns true for frame detached", () => {
    expect(isTransientPlaywrightError(new Error("frame was detached"))).toBe(true);
  });

  it("returns true for execution context destroyed", () => {
    expect(isTransientPlaywrightError(new Error("execution context was destroyed"))).toBe(true);
  });

  it("returns true for timeout waiting for element", () => {
    expect(isTransientPlaywrightError(new Error("Timeout 8000ms exceeded waiting for selector"))).toBe(true);
  });

  it("returns true for Target closed", () => {
    expect(isTransientPlaywrightError(new Error("Target closed"))).toBe(true);
  });

  it("returns false for ref is required", () => {
    expect(isTransientPlaywrightError(new Error("ref is required"))).toBe(false);
  });

  it("returns false for navigation policy error", () => {
    expect(isTransientPlaywrightError(new Error("Navigation to this URL is blocked by policy"))).toBe(false);
  });

  it("returns false for generic error", () => {
    expect(isTransientPlaywrightError(new Error("something went wrong"))).toBe(false);
  });
});

describe("withTransientRetry", () => {
  it("returns result on first success", async () => {
    const result = await withTransientRetry(async () => 42);
    expect(result).toBe(42);
  });

  it("retries on transient error and succeeds", async () => {
    let attempt = 0;
    const result = await withTransientRetry(
      async () => {
        attempt++;
        if (attempt < 2) {
          throw new Error("element not visible");
        }
        return "ok";
      },
      { delayMs: 10 },
    );
    expect(result).toBe("ok");
    expect(attempt).toBe(2);
  });

  it("throws non-transient error immediately without retry", async () => {
    let attempt = 0;
    await expect(
      withTransientRetry(
        async () => {
          attempt++;
          throw new Error("ref is required");
        },
        { delayMs: 10 },
      ),
    ).rejects.toThrow("ref is required");
    expect(attempt).toBe(1);
  });

  it("throws after max retries exhausted", async () => {
    let attempt = 0;
    await expect(
      withTransientRetry(
        async () => {
          attempt++;
          throw new Error("element not visible");
        },
        { maxRetries: 2, delayMs: 10 },
      ),
    ).rejects.toThrow("element not visible");
    expect(attempt).toBe(3); // initial + 2 retries
  });

  it("respects custom maxRetries=0", async () => {
    let attempt = 0;
    await expect(
      withTransientRetry(
        async () => {
          attempt++;
          throw new Error("element not visible");
        },
        { maxRetries: 0, delayMs: 10 },
      ),
    ).rejects.toThrow("element not visible");
    expect(attempt).toBe(1);
  });
});
