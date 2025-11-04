import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import MfaVerify from "@/features/auth/mfa-verify";

const mockVerifyMfa = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  useVerifyMfa: () => ({
    mutate: mockVerifyMfa,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams("?userId=123"));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams()],
  };
});

describe("MfaVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mfa verify page", () => {
    render(
      <BrowserRouter>
        <MfaVerify />
      </BrowserRouter>
    );
    expect(screen.getByText(/Verify Identity/)).toBeInTheDocument();
  });

  it("handles verify mfa", () => {
    mockVerifyMfa.mockImplementation((data, callbacks) => {
      callbacks.onSuccess({ success: true, message: "Success" });
    });

    render(
      <BrowserRouter>
        <MfaVerify />
      </BrowserRouter>
    );
    
    const otpInput = screen.getByPlaceholderText("000 000");
    const verifyButton = screen.getByText("Verify");

    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(verifyButton);

    expect(mockVerifyMfa).toHaveBeenCalled();
  });
});

