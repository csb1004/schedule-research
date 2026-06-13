import { createHmac, timingSafeEqual } from "node:crypto";

export function parseAdminNames(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function assertAdminNameAllowed(
  displayName: string,
  adminNames: string[],
  isAdmin: boolean,
): void {
  if (!isAdmin && adminNames.includes(displayName)) {
    throw new Error("관리자 이름은 관리자만 사용할 수 있습니다.");
  }
}

export type VerifiedAdminSession = {
  userId: string;
};

type AdminSessionPayload = {
  userId: string;
  expiresAt: number;
};

export async function signAdminSession(
  userId: string,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const payload: AdminSessionPayload = {
    userId,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<VerifiedAdminSession | null> {
  if (!token || !secret) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;

    if (!payload.userId || payload.expiresAt < Date.now()) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
