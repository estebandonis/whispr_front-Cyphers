import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
// Avoid importing utils -> root side-effects by mocking utils first
vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
  logout: vi.fn(),
}));

let CreateGroupModal: any;

vi.mock("@/features/user/queries", () => ({
  useCurrentUser: () => ({ data: { id: 1, name: "Me", username: "me" } }),
}));

vi.mock("@/features/chat/queries", () => ({
  useListUsers: () => ({
    data: [
      { id: 1, name: "Me", email: "me@test", avatar: "" },
      { id: 2, name: "A", email: "a@test", avatar: "" },
    ],
  }),
}));

describe("CreateGroupModal (minimal)", () => {
  beforeAll(async () => {
    ({ default: CreateGroupModal } = await import(
      "@/components/create-group-chat"
    ));
  });

  it("renders and can be closed via Cancel", async () => {
    const onCreateGroup = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CreateGroupModal
        open
        onOpenChange={onOpenChange}
        onCreateGroup={onCreateGroup}
      />
    );

    expect(screen.getByText(/Create Group Chat/i)).toBeInTheDocument();

    const cancel = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancel);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toggles user and submits form", async () => {
    const onCreateGroup = vi.fn().mockResolvedValue({});
    const onOpenChange = vi.fn();

    render(
      <CreateGroupModal
        open
        onOpenChange={onOpenChange}
        onCreateGroup={onCreateGroup}
      />
    );

    const input = screen.getByPlaceholderText("Enter group name...");
    fireEvent.change(input, { target: { value: "Test" } });

    const userDiv = screen.getByText("A").closest("div");
    fireEvent.click(userDiv!);

    const submit = screen.getByRole("button", { name: /Create Group/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(onCreateGroup).toHaveBeenCalled();
    });
  });

  it("toggles user off and handles empty form", async () => {
    const onCreateGroup = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CreateGroupModal
        open
        onOpenChange={onOpenChange}
        onCreateGroup={onCreateGroup}
      />
    );

    const userDiv = screen.getByText("A").closest("div");
    fireEvent.click(userDiv!);
    fireEvent.click(userDiv!);

    const input = screen.getByPlaceholderText("Enter group name...");
    fireEvent.change(input, { target: { value: "  " } });

    const form = screen
      .getByRole("button", { name: /Create Group/i })
      .closest("form");
    fireEvent.submit(form!);

    expect(onCreateGroup).not.toHaveBeenCalled();
  });

  it("handles checkbox onChange", async () => {
    const onCreateGroup = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CreateGroupModal
        open
        onOpenChange={onOpenChange}
        onCreateGroup={onCreateGroup}
      />
    );

    const userDiv = screen.getByText("A").closest("div");
    fireEvent.click(userDiv!);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.change(checkbox, { target: { checked: false } });
  });

  it("handles create error", async () => {
    const onCreateGroup = vi.fn().mockRejectedValue(new Error("fail"));
    const onOpenChange = vi.fn();

    render(
      <CreateGroupModal
        open
        onOpenChange={onOpenChange}
        onCreateGroup={onCreateGroup}
      />
    );

    const input = screen.getByPlaceholderText("Enter group name...");
    fireEvent.change(input, { target: { value: "Test" } });

    const userDiv = screen.getByText("A").closest("div");
    fireEvent.click(userDiv!);

    const submit = screen.getByRole("button", { name: /Create Group/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(onCreateGroup).toHaveBeenCalled();
    });
  });
});
