import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
// Avoid importing utils -> root side-effects by mocking utils first
vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
  logout: vi.fn(),
}));

let Button: any;
let Input: any;
let Dialog: any;
let DialogContent: any;
let DialogHeader: any;
let DialogTitle: any;
let DialogTrigger: any;
let DialogClose: any;
let DropdownMenu: any;
let DropdownMenuTrigger: any;
let DropdownMenuContent: any;
let DropdownMenuItem: any;
let DropdownMenuPortal: any;
let DropdownMenuGroup: any;
let DropdownMenuLabel: any;
let DropdownMenuSeparator: any;
let DropdownMenuCheckboxItem: any;
let DropdownMenuRadioGroup: any;
let DropdownMenuRadioItem: any;
let DropdownMenuShortcut: any;
let DropdownMenuSub: any;
let DropdownMenuSubTrigger: any;
let DropdownMenuSubContent: any;

beforeAll(async () => {
  ({ Button } = await import("@/components/ui/button"));
  ({ Input } = await import("@/components/ui/input"));
  ({
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
  } = await import("@/components/ui/dialog"));
  ({
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
  } = await import("@/components/ui/dropdown-menu"));
});

describe("UI components (smoke)", () => {
  it("renders Button variants", () => {
    const { rerender } = render(<Button>Default</Button>);
    expect(screen.getByText("Default")).toBeInTheDocument();
    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByText("Outline")).toBeInTheDocument();
    rerender(
      <Button asChild>
        <span>Child</span>
      </Button>
    );
    expect(screen.getByText("Child")).toBeInTheDocument();
  });

  it("renders Input", () => {
    render(<Input placeholder="Type" />);
    expect(screen.getByPlaceholderText("Type")).toBeInTheDocument();
  });

  it("renders Dialog open", () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
          Content
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders Dialog with trigger and close", () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogClose />
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders DropdownMenu open", () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText("Item")).toBeInTheDocument();
  });

  it("renders more dropdown components", () => {
    render(
      <DropdownMenu open onOpenChange={() => {}}>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Label</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>Check</DropdownMenuCheckboxItem>
              <DropdownMenuRadioGroup>
                <DropdownMenuRadioItem>Radio</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuItem>
                Item <DropdownMenuShortcut>Ctrl+K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Sub</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>SubItem</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    );
    expect(screen.getByText("Label")).toBeInTheDocument();
  });
});
