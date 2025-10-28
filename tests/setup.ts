import "@testing-library/jest-dom"; // if you use jest-dom matchers

// Provide a stable in-memory localStorage mock to avoid jsdom origin issues
class LocalStorageMock implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const localStorageMock = new LocalStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - window is provided by jsdom in this environment
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});
