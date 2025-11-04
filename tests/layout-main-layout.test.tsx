import React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

const mockUseCurrentUser = vi.fn();
vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/lib/crypto", () => ({
  initializeX3DH: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import MainLayout from "@/layouts/main-layout";
import * as cryptoLib from "@/lib/crypto";
import * as apiLib from "@/lib/api";

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders layout", () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 1, username: "test" },
    });

    render(
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    );
  });

  it("initializes keys when user exists and no keys", async () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 1, username: "test" },
    });
    vi.mocked(cryptoLib.initializeX3DH).mockResolvedValue({
      publicBundle: { test: "bundle" },
    });
    vi.mocked(apiLib.default.post).mockResolvedValue({} as any);

    render(
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    );

    await vi.waitFor(() => {
      expect(cryptoLib.initializeX3DH).toHaveBeenCalled();
    });
  });
});

