/**
 * The 401 decision matrix on the shared axios instance.
 *
 * Every rejected response passes through three interacting branch families:
 * an exact self-handled path allowlist, an ambiguous-code map, and a
 * normalized-route redirect set. Getting any of them wrong is silent and
 * user-visible in the worst way — either a clinician is logged out mid-task,
 * or a dead session is left looking alive. These pin the behaviour so a later
 * endpoint rename or envelope change fails here instead of in a clinic.
 */
import axios, { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({ clearSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { api } from "./api";
import { clearSession } from "./auth";

const mockedClearSession = vi.mocked(clearSession);

/** Drive a real request through the instance's interceptor with a stubbed transport. */
async function request(
  url: string,
  status: number,
  detail?: unknown,
): Promise<void> {
  const adapter = vi.fn().mockImplementation((config) => {
    const error = new AxiosError(
      `Request failed with status code ${status}`,
      String(status),
      config,
      null,
      {
        status,
        statusText: "",
        headers: new AxiosHeaders(),
        config,
        data: detail === undefined ? {} : { detail },
      },
    );
    return Promise.reject(error);
  });
  // The instance under test keeps its interceptor; only the transport is faked.
  await expect(api.request({ url, adapter })).rejects.toBeInstanceOf(AxiosError);
}

/**
 * Put the browser on `path` and capture navigations.
 *
 * jsdom's `window.location` is [Unforgeable] — its `assign` cannot be spied on
 * in place, and a real assign only warns "Not implemented". Swap the whole
 * object so the redirect branch is observable.
 */
const assign = vi.fn();

function atPath(path: string, search = ""): void {
  vi.stubGlobal("location", {
    pathname: path,
    search,
    href: `http://localhost${path}${search}`,
    assign,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  atPath("/dashboard");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("401 on a protected request", () => {
  it("clears the session and redirects, preserving the intended destination", async () => {
    atPath("/mothers", "?page=2");
    await request("/mothers", 401, {
      error_code: "token_expired",
      message: "expired",
    });

    expect(mockedClearSession).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(
      "/login?next=%2Fmothers%3Fpage%3D2",
    );
  });

  it("treats the /auth/me bootstrap as authoritative", async () => {
    // The regression this guards: excluding /auth/me left the persisted
    // clinician profile passing RequireAuth, so an expired cookie produced a
    // signed-in shell with empty permissions instead of a logout.
    await request("/auth/me", 401);
    expect(mockedClearSession).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalled();
  });
});

describe("endpoints that own their 401 inline", () => {
  it.each([
    ["/auth/sign-in", "invalid_credentials"],
    ["/auth/set-password", "setup_token_expired"],
    ["/auth/verify-token", "invalid_setup_token"],
    ["/auth/forgot-password", "unknown"],
  ])("leaves %s to the page", async (path, code) => {
    await request(path, 401, { error_code: code, message: "nope" });
    expect(mockedClearSession).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("/auth/change-password is ambiguous and discriminates on error_code", () => {
  it("lets the page own a wrong CURRENT password", async () => {
    await request("/auth/change-password", 401, {
      error_code: "invalid_credentials",
      message: "wrong password",
    });
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it("still logs out when the SESSION died on the same endpoint", async () => {
    // Allowlisting this path wholesale would strand a clinician on the forced
    // rotation screen, told forever that a correct password is wrong.
    await request("/auth/change-password", 401, {
      error_code: "token_expired",
      message: "session over",
    });
    expect(mockedClearSession).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalled();
  });
});

describe("request-URL normalization", () => {
  it("matches a self-handled path given as an absolute URL", async () => {
    await request("https://api.omayacare.com/auth/sign-in", 401, {
      error_code: "invalid_credentials",
      message: "nope",
    });
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it("matches a self-handled path with a trailing slash and a query string", async () => {
    await request("/auth/sign-in/?redirect=1", 401, {
      error_code: "invalid_credentials",
      message: "nope",
    });
    expect(mockedClearSession).not.toHaveBeenCalled();
  });
});

describe("public auth screens carrying a one-shot link token", () => {
  it.each(["/activate", "/reset", "/login", "/forgot-password", "/"])(
    "clears the dead session on %s but does NOT redirect",
    async (path) => {
      // Bouncing to /login would discard the ?token= these screens depend on.
      atPath(path, "?token=one-shot");
      await request("/mothers", 401);

      expect(mockedClearSession).toHaveBeenCalledOnce();
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it("normalizes a trailing slash so /login/ does not redirect to itself", async () => {
    atPath("/login/");
    await request("/mothers", 401);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("statuses other than 401", () => {
  it("never clears the session on a 403", async () => {
    await request("/mothers", 403, {
      error_code: "forbidden",
      message: "no",
    });
    expect(mockedClearSession).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("surfaces a 5xx as a toast without touching the session", async () => {
    const { toast } = await import("sonner");
    await request("/mothers", 500, {
      error_code: "internal",
      message: "boom",
    });
    expect(toast.error).toHaveBeenCalledWith("boom");
    expect(mockedClearSession).not.toHaveBeenCalled();
  });
});

describe("the axios instance itself", () => {
  it("sends cookies — the session credential is HttpOnly and unreadable to JS", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("is not the global axios instance, so the interceptor stays scoped", () => {
    expect(api).not.toBe(axios);
  });
});
