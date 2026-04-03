import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  ensureAuthEnv,
  loginPayloadSchema,
  validateAdminCredentials,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    ensureAuthEnv();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Missing auth configuration. Check environment variables.",
      },
      { status: 500 }
    );
  }

  const payload = loginPayloadSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid email or password format." }, { status: 400 });
  }

  const isValid = await validateAdminCredentials(payload.data.email, payload.data.password);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSessionToken(payload.data.email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return response;
}
