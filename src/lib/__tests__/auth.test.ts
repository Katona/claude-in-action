// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: mockGet })),
}));

import { getSession } from "@/lib/auth";
import { SignJWT } from "jose";

const JWT_SECRET = Buffer.from("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("getSession", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  test("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const payload = { userId: "user-1", email: "a@example.com", expiresAt: new Date() };
    mockGet.mockReturnValue({ value: await makeToken(payload) });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("a@example.com");
  });

  test("returns null for an expired token", async () => {
    const payload = { userId: "user-1", email: "a@example.com", expiresAt: new Date() };
    mockGet.mockReturnValue({ value: await makeToken(payload, "-1s") });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a tampered token", async () => {
    const token = await makeToken({ userId: "user-1", email: "a@example.com", expiresAt: new Date() });
    mockGet.mockReturnValue({ value: token + "tampered" });

    expect(await getSession()).toBeNull();
  });
});
