import { vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

import {
  useListUsers,
  useGetUserKeyBundle,
  useInitiateConversation,
  useGetConversationMessages,
  useGetPendingConversations,
  useAcceptConversation,
  useInitiateGroupConversation,
  useGetGroupConversations,
} from "@/features/chat/queries";
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

describe("Chat Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useListUsers fetches users", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: [{ id: 1, name: "User" }] } as any);

    const { result } = renderHook(() => useListUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("useGetUserKeyBundle fetches key bundle", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: { test: "bundle" } } as any);

    const { result } = renderHook(
      () => useGetUserKeyBundle("123", { enabled: true }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("useInitiateConversation initiates conversation", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { conversationId: "123" } } as any);

    const { result } = renderHook(() => useInitiateConversation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      recipientId: "123",
      payload: {
        iv: [1, 2, 3],
        ciphertext: [4, 5, 6],
        ephemeralKeyPublicJWK: {},
        initiatorId: "1",
      },
    });

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useGetConversationMessages fetches messages", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: [{ id: 1, content: "test" }] } as any);

    const { result } = renderHook(
      () => useGetConversationMessages("123", true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("useGetPendingConversations fetches pending conversations", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: [{ id: 1 }] } as any);

    const { result } = renderHook(
      () => useGetPendingConversations("123", { enabled: true }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("useAcceptConversation accepts conversation", async () => {
    vi.mocked(apiLib.default.put).mockResolvedValue({ data: { success: true } } as any);

    const { result } = renderHook(() => useAcceptConversation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      conversationId: "123",
      signingPublicKey: {},
    });

    expect(apiLib.default.put).toHaveBeenCalled();
  });

  it("useInitiateGroupConversation initiates group conversation", async () => {
    vi.mocked(apiLib.default.post).mockResolvedValue({ data: { conversationId: "123" } } as any);

    const { result } = renderHook(() => useInitiateGroupConversation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      name: "Test Group",
      members: [
        {
          id: 1,
          payload: {
            iv: [1, 2, 3],
            ciphertext: [4, 5, 6],
            ephemeralKeyPublicJWK: {},
            initiatorId: "1",
          },
        },
      ],
    });

    expect(apiLib.default.post).toHaveBeenCalled();
  });

  it("useGetGroupConversations fetches group conversations", async () => {
    vi.mocked(apiLib.default.get).mockResolvedValue({ data: [{ id: 1, name: "Group" }] } as any);

    const { result } = renderHook(() => useGetGroupConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

