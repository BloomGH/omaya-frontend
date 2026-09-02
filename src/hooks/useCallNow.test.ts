import { describe, expect, it } from "vitest";
import { callNowErrorMessage, stableCallIdempotencyKey } from "./useCallNow";

describe("useCallNow shared phone-call behavior", () => {
  it("reuses one key for a transport retry and mints a new action key after reset", () => {
    const ref = { current: null as string | null };
    const first = stableCallIdempotencyKey(ref);
    expect(stableCallIdempotencyKey(ref)).toBe(first);
    ref.current = null;
    expect(stableCallIdempotencyKey(ref)).not.toBe(first);
  });

  it("maps the backend in-flight response used by both call surfaces", () => {
    expect(callNowErrorMessage(409, "call_in_flight")).toBe(
      "A call for this mother is already queued or in progress.",
    );
  });
});
