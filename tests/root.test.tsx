import { vi } from "vitest";

// Mock document.getElementById before importing root
const mockGetElementById = vi.fn(() => ({
  appendChild: vi.fn(),
}));
Object.defineProperty(document, "getElementById", {
  value: mockGetElementById,
  writable: true,
});

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
  })),
}));

vi.mock("@/index.css", () => ({}));

describe("root", () => {
  it("can import root module", async () => {
    // Just verify the module can be imported without errors
    await import("@/root");
    expect(true).toBe(true);
  });
});

