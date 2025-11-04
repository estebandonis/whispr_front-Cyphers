import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";
import OAuth from "@/features/auth/oauth";

const mockLoginWithGithubOAuth = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  useGithubOAuthLogin: () => ({
    mutateAsync: mockLoginWithGithubOAuth,
    isPending: false,
    error: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams("?code=test-code"));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams()],
  };
});

describe("OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders oauth page", () => {
    render(
      <BrowserRouter>
        <OAuth />
      </BrowserRouter>
    );
    expect(screen.getByText(/GitHub/)).toBeInTheDocument();
  });

  it("handles oauth success", async () => {
    mockLoginWithGithubOAuth.mockResolvedValue({ success: true, message: "Success" });

    render(
      <BrowserRouter>
        <OAuth />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(mockLoginWithGithubOAuth).toHaveBeenCalledWith("test-code");
    });
  });

  it("handles oauth with mfa", async () => {
    mockLoginWithGithubOAuth.mockResolvedValue({ success: true, mfa: true, userId: "123" });

    render(
      <BrowserRouter>
        <OAuth />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/mfa/verify?userId=123");
    });
  });
});

