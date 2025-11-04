import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserRouter } from "react-router";
import ChatLayout from "@/layouts/chat-layout";

const mockUseListUsers = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseInitiateGroupConversation = vi.fn();
const mockUseGetGroupConversations = vi.fn();
const mockUseDeleteUser = vi.fn();
vi.mock("@/features/chat/queries", () => ({
  useListUsers: () => mockUseListUsers(),
  useInitiateGroupConversation: () => mockUseInitiateGroupConversation(),
  useGetGroupConversations: () => mockUseGetGroupConversations(),
  useDeleteUser: () => mockUseDeleteUser(),
}));

vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
  logout: vi.fn(),
}));

vi.mock("@/lib/conversation-store", () => ({
  saveConversationKeys: vi.fn().mockResolvedValue(123),
}));

vi.mock("@/lib/crypto", () => ({
  initializeX3DHSession: vi.fn().mockResolvedValue({
    sharedKey: {} as CryptoKey,
    ephemeralKeyPublicJWK: {},
    usedOPKId: "1",
  }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
}));

vi.mock("@/components/corner-accents", () => ({
  default: () => <div>CornerAccents</div>,
}));

vi.mock("@/components/mfa-reset-dialog", () => ({
  default: ({ open, onOpenChange }: any) => (
    open ? <div>MfaResetDialog</div> : null
  ),
}));

vi.mock("@/components/create-group-chat", () => ({
  default: ({ open, onOpenChange, onCreateGroup }: any) => (
    open ? <div>CreateGroupModal</div> : null
  ),
}));

vi.mock("@/features/loading", () => ({
  default: () => <div>Loading...</div>,
}));

const mockQueryClient = {
  fetchQuery: vi.fn(),
  invalidateQueries: vi.fn(),
  clear: vi.fn(),
};
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

describe("ChatLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListUsers.mockReturnValue({
      data: [
        { id: 1, name: "User 1" },
        { id: 2, name: "User 2" },
      ],
    });
    mockUseCurrentUser.mockReturnValue({
      data: { id: 1, name: "Current User", username: "current" },
    });
    mockUseInitiateGroupConversation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ conversationId: "123" }),
    });
    mockUseGetGroupConversations.mockReturnValue({
      data: [{ id: 1, name: "Group 1" }],
    });
    mockUseDeleteUser.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isSuccess: false,
    });
    mockQueryClient.fetchQuery.mockResolvedValue({});
  });

  it("renders chat layout", () => {
    render(
      <BrowserRouter>
        <ChatLayout />
      </BrowserRouter>
    );
    expect(screen.getByText("Whispr")).toBeInTheDocument();
  });

  it("handles create group chat", async () => {
    render(
      <BrowserRouter>
        <ChatLayout />
      </BrowserRouter>
    );

    const createButton = screen.getByText("Create Group Chat");
    fireEvent.click(createButton);

    // Modal should open (handled by CreateGroupModal component)
  });
});

