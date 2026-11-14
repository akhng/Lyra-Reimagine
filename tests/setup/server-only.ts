import { vi } from "vitest";

// `server-only` throws outside a React Server environment; tests run server modules directly.
vi.mock("server-only", () => ({}));
