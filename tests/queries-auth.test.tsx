import { vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import {
  useLogin,
  useGithubOAuthLogin,
  useRegister,
  useValidateJwtToken,
  useLogout,
  useSetUpMfa,
  useVerifyMfa,
  useResetMfa,
  useEnableMfa,
} from "@/features/auth/queries";
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

describe("Auth Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useLogin logs in user", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({
      data: { success: true, message: "Success" },
    } as any);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      username: "test",
      password: "pass",
    });

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useGithubOAuthLogin logs in with GitHub", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({
      data: { success: true, message: "Success" },
    } as any);

    const { result } = renderHook(() => useGithubOAuthLogin(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("code");

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useRegister registers user", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { success: true } } as any);

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: "Test",
      username: "test",
      password: "pass",
    });

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useValidateJwtToken validates token", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: { valid: true } } as any);

    const { result } = renderHook(() => useValidateJwtToken("token"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("useLogout logs out user", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { success: true } } as any);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useSetUpMfa sets up MFA", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({
      data: { secret: "secret", qrCode: "qr" },
    } as any);

    const { result } = renderHook(() => useSetUpMfa(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useVerifyMfa verifies MFA", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({
      data: { success: true, message: "Success" },
    } as any);

    const { result } = renderHook(() => useVerifyMfa(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      token: "123456",
      userId: "1",
    });

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useResetMfa resets MFA", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { message: "Success" } } as any);

    const { result } = renderHook(() => useResetMfa(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useEnableMfa enables MFA", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { message: "Success" } } as any);

    const { result } = renderHook(() => useEnableMfa(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(apiLib.default.post).toHaveBeenCalled();
  });
});

