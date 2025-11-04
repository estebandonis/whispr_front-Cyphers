import React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

let Toaster: any;
beforeAll(async () => {
  ({ Toaster } = await import("@/components/ui/sonner"));
});

describe("Toaster", () => {
  it("renders", () => {
    render(<Toaster />);
  });
});

