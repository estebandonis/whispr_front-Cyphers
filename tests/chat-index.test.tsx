import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/root", () => ({
  queryClient: {
    clear: vi.fn(),
  },
}));

// Mock router params
const mockUseParams = vi.fn(() => ({ id: undefined, group: undefined }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual<any>("react-router");
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

// Mock current user
const mockCurrentUser = { id: 1, username: "user", name: "User" };
vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => ({ data: mockCurrentUser }),
}));

// Mock crypto functions
vi.mock("@/lib/message-crypto", () => ({
  prepareSecureMessage: vi.fn(),
  processSecureMessage: vi.fn(),
}));

// Mock conversation store
const mockLoadConversationKeys = vi.fn();
const mockGetConversationWithUser = vi.fn();
const mockGetConversationWithConvId = vi.fn();
vi.mock("@/lib/conversation-store", () => ({
  getConversationWithUser: (...args: any[]) =>
    mockGetConversationWithUser(...args),
  getConversationWithConvId: (...args: any[]) =>
    mockGetConversationWithConvId(...args),
  loadConversationKeys: (...args: any[]) => mockLoadConversationKeys(...args),
  saveConversationKeys: vi.fn(),
}));

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  initializeX3DHSession: vi.fn(),
  completeX3DHRecipient: vi.fn(),
  getPrivateKeys: vi.fn(),
}));

// Mock chat queries
const mockRefetchMessages = vi.fn();
const mockUseGetConversationMessages = vi.fn();
vi.mock("@/features/chat/queries", () => ({
  useGetUserKeyBundle: vi.fn(),
  useInitiateConversation: vi.fn(),
  useGetPendingConversations: vi.fn(),
  useAcceptConversation: vi.fn(),
  useGetConversationMessages: (...args: any[]) =>
    mockUseGetConversationMessages(...args),
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
  logout: vi.fn(),
}));

// Mock WebSocket
class MockWebSocket {
  addEventListener = vi.fn();
  send = vi.fn();
  close = vi.fn();
  readyState = WebSocket.CONNECTING;
  constructor(url: string) {}
}
global.WebSocket = MockWebSocket as any;

import Chat from "@/features/chat/index";
import * as chatQueries from "@/features/chat/queries";
import * as messageCrypto from "@/lib/message-crypto";

describe("Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: undefined, group: undefined });
    vi.mocked(messageCrypto.processSecureMessage).mockClear();
    vi.mocked(chatQueries.useGetUserKeyBundle).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);
    vi.mocked(chatQueries.useInitiateConversation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ conversationId: "42" }),
    } as any);
    vi.mocked(chatQueries.useGetPendingConversations).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(chatQueries.useAcceptConversation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
    } as any);
    mockUseGetConversationMessages.mockReturnValue({
      data: [],
      refetch: mockRefetchMessages,
    } as any);
  });

  it("renders early when no user id", () => {
    render(<Chat />);
    expect(screen.getByText(/No conversation selected/)).toBeInTheDocument();
  });

  it("renders chat when conversation exists", async () => {
    mockUseParams.mockReturnValue({ id: "123", group: "false" });

    // Create mock keys
    const symKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const signKeyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    mockGetConversationWithUser.mockReturnValue("123");
    mockLoadConversationKeys.mockResolvedValue({
      convId: 123,
      symKey,
      signKeyPair,
      type: "DIRECT" as const,
    });

    mockUseGetConversationMessages.mockReturnValue({
      data: [],
      refetch: mockRefetchMessages,
    } as any);

    render(<Chat />);

    // Just verify the component renders without error
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Message...")).toBeInTheDocument();
    });
  });
});
