import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import MfaResetDialog from "@/components/mfa-reset-dialog";

const mockResetMfa = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  useResetMfa: () => ({
    mutate: mockResetMfa,
    isPending: false,
  }),
}));

describe("MfaResetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog when open", () => {
    render(<MfaResetDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Disable MFA")).toBeInTheDocument();
  });

  it("handles reset mfa", () => {
    const mockOnOpenChange = vi.fn();
    mockResetMfa.mockImplementation((data, callbacks) => {
      callbacks.onSuccess();
    });

    render(<MfaResetDialog open={true} onOpenChange={mockOnOpenChange} />);

    const disableButton = screen.getByText("Disable");
    fireEvent.click(disableButton);

    expect(mockResetMfa).toHaveBeenCalled();
  });
});
