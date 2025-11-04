import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";
import ProtectedRoute from "@/layouts/protected-route";

const mockUseCurrentUser = vi.fn();
vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/features/loading", () => ({
  default: () => <div>Loading...</div>,
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when user is loading", () => {
    mockUseCurrentUser.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows content when user is authenticated", () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 1, username: "test" },
      isLoading: false,
      error: null,
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects when user is not authenticated", () => {
    mockUseCurrentUser.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Not authenticated"),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Should redirect (Navigate component will handle this)
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});

