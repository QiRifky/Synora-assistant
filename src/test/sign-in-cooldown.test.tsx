import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSignInCooldown } from "@/hooks/use-sign-in-cooldown";

describe("sign-in cooldown", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); sessionStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

  it("blocks repeated clicks until a 30-second wait has expired", () => {
    const { result } = renderHook(() => useSignInCooldown(true, 0.5));
    expect(result.current.remaining).toBe(30);
    result.current.startSignIn();
    expect(result.current.remaining).toBe(30);
    expect(sessionStorage.getItem("synora:sign-in-cooldown")).not.toBeNull();
    act(() => vi.advanceTimersByTime(29_000));
    expect(result.current.remaining).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(0);
  });

  it("retains the original deadline when the page is reopened", () => {
    const first = renderHook(() => useSignInCooldown(true, 0.5));
    act(() => vi.advanceTimersByTime(10_000));
    first.unmount();
    const next = renderHook(() => useSignInCooldown(true, 0.5));
    expect(next.result.current.remaining).toBe(20);
  });

  it("leaves sign-in enabled without a rate-limit error", () => {
    const { result } = renderHook(() => useSignInCooldown(false, 781));
    expect(result.current.remaining).toBe(0);
  });
});