import { NextRequest, NextResponse } from "next/server";
import { checkPassword, passwordStrengthMessage } from "@/lib/passwordSecurity";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const password: unknown = body?.password;
    const hints: unknown = body?.hints;

    if (typeof password !== "string" || password.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Password is required." },
        { status: 400 }
      );
    }

    const MAX_PASSWORD_LENGTH = 128;
    if (password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "Password must be 128 characters or fewer." },
        { status: 400 }
      );
    }

    const userInputs = Array.isArray(hints)
      ? hints.filter((v): v is string => typeof v === "string").slice(0, 10)
      : [];

    const result = await checkPassword(password, userInputs);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: passwordStrengthMessage(result), score: result.score ?? 0 },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, score: result.score ?? 4 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "We could not validate your password." },
      { status: 500 }
    );
  }
}
