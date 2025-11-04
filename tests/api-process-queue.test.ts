import api from "@/lib/api";
import { vi } from "vitest";

describe("api processQueue error path", () => {
  it("processes queue with error", async () => {
    let refreshCount = 0;
    const rejected: any[] = [];

    api.defaults.adapter = (async (config: any) => {
      if (config.url === "/auth/refresh-token") {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 30));
        const error: any = new Error("Refresh failed");
        error.config = config;
        error.response = { status: 500 };
        return Promise.reject(error);
      }
      if (!config._retry) {
        const error: any = new Error("Unauthorized");
        error.config = config;
        error.response = { status: 401 };
        return Promise.reject(error);
      }
      return { config, status: 200, data: {} } as any;
    }) as any;

    const p1 = api.get("/x").catch((e) => rejected.push(e));
    const p2 = api.get("/y").catch((e) => rejected.push(e));

    await Promise.allSettled([p1, p2]);
    expect(refreshCount).toBeGreaterThan(0);
  });
});
