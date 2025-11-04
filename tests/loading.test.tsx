import React from "react";
import { render } from "@testing-library/react";
import Loading from "@/features/loading";

describe("Loading", () => {
  it("renders", () => {
    render(<Loading />);
  });
});

