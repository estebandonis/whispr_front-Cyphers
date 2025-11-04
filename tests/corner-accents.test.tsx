import React from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

import CornerAccents from "@/components/corner-accents";

describe("CornerAccents", () => {
  it("renders", () => {
    render(<CornerAccents />);
  });
});

