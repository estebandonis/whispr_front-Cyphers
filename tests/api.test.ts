import api from "@/lib/api";
import { vi } from "vitest";

describe("api interceptor (minimal)", () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = originalAdapter as any;
  });

  it("handles 401 by refreshing and retrying once", async () => {
    let refreshed = false;
    const calls: string[] = [];

    api.defaults.adapter = (async (config: any) => {
      const url = config.url as string;
      calls.push(url);
      if (url === "/auth/refresh-token") {
        refreshed = true;
        return {
          config,
          status: 200,
          statusText: "OK",
          headers: {},
          data: {},
        } as any;
      }
      if (!refreshed) {
        const error: any = new Error("Unauthorized");
        error.config = config;
        error.response = { status: 401 };
        return Promise.reject(error);
      }
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: {},
        data: { ok: true },
      } as any;
    }) as any;

    const res = await api.get("/foo");
    expect(res.status).toBe(200);
    expect(calls).toContain("/auth/refresh-token");
  });

  it("skips refresh for auth endpoints", async () => {
    api.defaults.adapter = (async (config: any) => {
      const error: any = new Error("Unauthorized");
      error.config = config;
      error.response = { status: 401 };
      return Promise.reject(error);
    }) as any;

    await expect(api.get("/auth/login")).rejects.toBeTruthy();
  });

  it("processes queue on refresh success", async () => {
    let calls: string[] = [];
    api.defaults.adapter = (async (config: any) => {
      calls.push(config.url);
      if (config.url === "/auth/refresh-token") {
        await new Promise((r) => setTimeout(r, 20));
        return { config, status: 200, data: {} } as any;
      }
      if (!config._retry) {
        const error: any = new Error("Unauthorized");
        error.config = config;
        error.response = { status: 401 };
        return Promise.reject(error);
      }
      return { config, status: 200, data: {} } as any;
    }) as any;

    const p1 = api.get("/a");
    const p2 = api.get("/b");
    await Promise.all([p1, p2]);
    expect(calls).toContain("/auth/refresh-token");
    expect(
      calls.filter((x) => x === "/a" || x === "/b").length
    ).toBeGreaterThan(2);
  });

  it("redirects on refresh failure", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/chat", href: "" },
      configurable: true,
    });
    const setHref = vi.fn();
    Object.defineProperty(window.location, "href", {
      set: setHref,
      configurable: true,
    });

    api.defaults.adapter = (async (config: any) => {
      if (config.url === "/auth/refresh-token") {
        const error: any = new Error("Failed");
        error.config = config;
        error.response = { status: 500 };
        return Promise.reject(error);
      }
      const error: any = new Error("Unauthorized");
      error.config = config;
      error.response = { status: 401 };
      return Promise.reject(error);
    }) as any;

    await expect(api.get("/x")).rejects.toBeTruthy();
    expect(setHref).toHaveBeenCalledWith("/");
  });
});
