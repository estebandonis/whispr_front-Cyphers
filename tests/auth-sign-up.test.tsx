import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import SignUpPage from "@/features/auth/sign-up";

const mockRegister = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  useRegister: () => ({
    mutate: mockRegister,
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

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign up form", () => {
    render(
      <BrowserRouter>
        <SignUpPage />
      </BrowserRouter>
    );
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm Password")).toBeInTheDocument();
  });

  it("handles sign up", () => {
    mockRegister.mockImplementation((data, callbacks) => {
      callbacks.onSuccess();
    });

    render(
      <BrowserRouter>
        <SignUpPage />
      </BrowserRouter>
    );

    const nameInput = screen.getByPlaceholderText("Name");
    const usernameInput = screen.getByPlaceholderText("Username");
    const passwordInput = screen.getByPlaceholderText("Password");
    const confirmPasswordInput =
      screen.getByPlaceholderText("Confirm Password");
    const signUpButton = screen.getByText("Sign Up");

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(usernameInput, { target: { value: "testuser" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "password123" },
    });
    fireEvent.click(signUpButton);

    expect(mockRegister).toHaveBeenCalled();
  });
});
