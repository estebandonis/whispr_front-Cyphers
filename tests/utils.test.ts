import { vi } from "vitest";
import { cn, logout, getCurrentUserId } from "@/lib/utils";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("utils", () => {
  it("cn merges classes", () => {
    expect(cn("a", "b")).toBeTruthy();
  });

  it("logout handles error", async () => {
    const api = await import("@/lib/api");
    (api.default.post as any).mockRejectedValue(new Error("fail"));
    await logout();
  });

  it("getCurrentUserId returns from localStorage or default", () => {
    localStorage.setItem("currentUserId", "123");
    expect(getCurrentUserId()).toBe("123");
    localStorage.removeItem("currentUserId");
    expect(getCurrentUserId()).toBe("1");
  });
});

