import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";

export const SESSION_COOKIE_NAME = "tt_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const loginPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type AdminSession = JWTPayload & {
  email: string;
  role: "admin";
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  return new TextEncoder().encode(secret);
}

function getAdminEmail() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL is not set");
  }

  return email.toLowerCase();
}

function getAdminPasswordHash() {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    throw new Error("ADMIN_PASSWORD_HASH is not set");
  }

  return hash;
}

export async function validateAdminCredentials(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();
  if (normalizedEmail !== getAdminEmail()) {
    return false;
  }

  const hash = getAdminPasswordHash();
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(email: string) {
  return new SignJWT({ email: email.toLowerCase(), role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());

    if (payload.role !== "admin" || typeof payload.email !== "string") {
      return null;
    }

    return payload as AdminSession;
  } catch {
    return null;
  }
}

export function applySessionCookie(response: Response, token: string) {
  if (!(response instanceof Response)) {
    throw new Error("Expected a Response object");
  }

  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`
  );
}

export function clearSessionCookie(response: Response) {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
}

export async function getCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function ensureAuthEnv() {
  getAuthSecret();
  getAdminEmail();
  getAdminPasswordHash();
}
