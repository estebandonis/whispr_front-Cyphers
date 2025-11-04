import { vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import { useCurrentUser } from "@/features/user/queries";
import * as apiLib from "@/lib/api";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("User Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCurrentUser fetches current user", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({
      data: { id: 1, username: "test", name: "Test User" },
    } as any);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

