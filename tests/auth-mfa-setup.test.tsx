import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import MfaSetup from "@/features/auth/mfa-setup";

const mockSetUpMfa = vi.fn();
const mockEnableMfa = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  useSetUpMfa: () => ({
    mutate: mockSetUpMfa,
    isPending: false,
  }),
  useEnableMfa: () => ({
    mutate: mockEnableMfa,
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
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/features/loading", () => ({
  default: () => <div>Loading...</div>,
}));

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe("MfaSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetUpMfa.mockImplementation((data, callbacks) => {
      callbacks.onSuccess({
        secret: "test-secret",
        qrCode: "data:image/png;base64,test",
      });
    });
  });

  it("renders mfa setup page", async () => {
    render(
      <BrowserRouter>
        <MfaSetup />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Setup Multi-Factor Authentication/)
      ).toBeInTheDocument();
    });
  });

  it("handles enable mfa", async () => {
    mockEnableMfa.mockImplementation((data, callbacks) => {
      callbacks.onSuccess();
    });

    render(
      <BrowserRouter>
        <MfaSetup />
      </BrowserRouter>
    );

    await waitFor(() => {
      const enableButton = screen.getByText("Enable");
      fireEvent.click(enableButton);
    });

    expect(mockEnableMfa).toHaveBeenCalled();
  });
});
