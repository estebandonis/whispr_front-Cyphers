import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, beforeEach, expect, vi } from "vitest";

// Shared mutable state for mocks so tests can tweak behavior per-case
const routerState: { params: any } = { params: { id: "5", group: "false" } };

// Mock react-router useParams to drive branches
vi.mock("react-router", () => ({
  useParams: () => routerState.params,
}));

// Mock UI components imported via alias to avoid resolution issues and heavy deps
vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => React.createElement("button", props, props.children),
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => React.createElement("input", props),
}));

// Mock user query
vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => ({ data: { id: 1, username: "me" } }),
}));

// Mock message-crypto
const messageCrypto = {
  prepareSecureMessage: vi.fn().mockResolvedValue({ ok: true }),
  processSecureMessage: vi
    .fn()
    .mockResolvedValue({ message: "hello", isAuthentic: true }),
};
vi.mock("@/lib/message-crypto", () => messageCrypto);

// Mock conversation-store with mutable fns
const store = {
  getConversationWithUser: vi.fn(),
  getConversationWithConvId: vi.fn(),
  loadConversationKeys: vi.fn(),
  saveConversationKeys: vi.fn().mockResolvedValue(123),
};
vi.mock("@/lib/conversation-store", () => store);

// Mock chat queries hooks
const chatQueriesState = {
  userKeyBundleData: undefined as any,
  isLoadingKeyBundle: false,
  pendingConversationsData: [] as any[],
  isLoadingPending: false,
  messagesData: [] as any[],
  refetch: vi.fn(),
  initiateConversationMock: vi
    .fn()
    .mockResolvedValue({ conversationId: "777" }),
  acceptConversationMock: vi.fn().mockResolvedValue({}),
};
vi.mock("@/features/chat/queries", () => ({
  useGetUserKeyBundle: () => ({
    data: chatQueriesState.userKeyBundleData,
    isLoading: chatQueriesState.isLoadingKeyBundle,
  }),
  useInitiateConversation: () => ({
    mutateAsync: chatQueriesState.initiateConversationMock,
  }),
  useGetPendingConversations: () => ({
    data: chatQueriesState.pendingConversationsData,
    isLoading: chatQueriesState.isLoadingPending,
  }),
  useAcceptConversation: () => ({
    mutateAsync: chatQueriesState.acceptConversationMock,
  }),
  useGetConversationMessages: () => ({
    data: chatQueriesState.messagesData,
    refetch: chatQueriesState.refetch,
  }),
}));

// Mock crypto used by Chat X3DH session
const cryptoState: {
  sharedKey?: CryptoKey;
} = {};
vi.mock("@/lib/crypto", () => ({
  initializeX3DHSession: vi.fn(async () => {
    if (!cryptoState.sharedKey) {
      cryptoState.sharedKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    }
    return {
      sharedKey: cryptoState.sharedKey,
      ephemeralKeyPublicJWK: {},
      usedOPKId: 0,
    };
  }),
  completeX3DHRecipient: vi.fn(async () => {
    if (!cryptoState.sharedKey) {
      cryptoState.sharedKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    }
    return { sharedKey: cryptoState.sharedKey };
  }),
  getPrivateKeys: vi.fn().mockResolvedValue({}),
}));

// WebSocket stub: auto-open; keep lightweight
class WSStub {
  readyState = 1;
  private listeners = new Map<string, Function[]>();
  constructor(_url: string) {
    queueMicrotask(() => this.emit("open", {}));
    (globalThis as any).__lastWS = this;
  }
  addEventListener(type: string, cb: any) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
  }
  emit(type: string, ev: any) {
    (this.listeners.get(type) ?? []).forEach((fn) => fn(ev));
  }
  send(_msg: string) {}
  close() {
    this.emit("close", { code: 1000 });
  }
}
vi.stubGlobal("WebSocket", WSStub as any);

describe("Chat component flows", () => {
  beforeEach(() => {
    // reset stateful mocks
    routerState.params = { id: "5", group: "false" };
    chatQueriesState.userKeyBundleData = undefined;
    chatQueriesState.isLoadingKeyBundle = false;
    chatQueriesState.pendingConversationsData = [];
    chatQueriesState.isLoadingPending = false;
    chatQueriesState.messagesData = [];
    chatQueriesState.refetch = vi.fn();
    chatQueriesState.initiateConversationMock.mockClear();
    chatQueriesState.acceptConversationMock.mockClear();
    store.getConversationWithUser.mockReset();
    store.getConversationWithConvId.mockReset();
    store.loadConversationKeys.mockReset();
    store.saveConversationKeys.mockClear();
    messageCrypto.processSecureMessage.mockClear();
  });

  it("renders placeholder when no conversation selected", async () => {
    routerState.params = {};
    const Chat = (await import("../src/features/chat/index")).default;
    render(<Chat />);
    expect(screen.getByText(/No conversation selected/i)).toBeInTheDocument();
  });

  it("loads existing conversation and displays messages", async () => {
    const Chat = (await import("../src/features/chat/index")).default;

    const symKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const signPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    store.getConversationWithUser.mockReturnValue("123");
    store.loadConversationKeys.mockResolvedValue({
      convId: 123,
      symKey,
      signKeyPair: signPair,
      theirSignPubKey: await crypto.subtle.exportKey("jwk", signPair.publicKey),
      type: "DIRECT",
    });

    chatQueriesState.messagesData = [
      {
        content: JSON.stringify({}),
        senderId: 2,
        senderName: "Alice",
        createdAt: Date.now(),
      },
    ];

    render(<Chat />);

    await waitFor(() =>
      expect(
        screen.getByText(/Secure session established/i)
      ).toBeInTheDocument()
    );

    const ws: any = (globalThis as any).__lastWS;
    ws.emit("message", {
      data: JSON.stringify({
        type: "message",
        encryptedContent: JSON.stringify({ any: true }),
        senderId: "2",
        senderName: "Alice",
        timestamp: Date.now(),
      }),
    });

    await waitFor(() => expect(screen.getByText("hello")).toBeInTheDocument());

    expect(store.loadConversationKeys).toHaveBeenCalledTimes(1);
    expect(store.saveConversationKeys).not.toHaveBeenCalled();
  });

  it("initializes new conversation and saves keys", async () => {
    const Chat = (await import("../src/features/chat/index")).default;

    store.getConversationWithUser.mockReturnValue(null);
    chatQueriesState.pendingConversationsData = [];
    chatQueriesState.userKeyBundleData = { any: "bundle" };

    render(<Chat />);

    await waitFor(() =>
      expect(
        screen.getByText(/Secure session established/i)
      ).toBeInTheDocument()
    );

    expect(chatQueriesState.initiateConversationMock).toHaveBeenCalledTimes(1);
    expect(store.saveConversationKeys).toHaveBeenCalledTimes(1);
  });
});
