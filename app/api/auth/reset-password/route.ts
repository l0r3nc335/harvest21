import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPassword, passwordStrengthMessage } from "@/lib/passwordSecurity";
import { passwordFieldSchema } from "@/lib/validations";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { reportServerError } from "@/lib/errorReporting";
import { z } from "zod";

const resetSchema = z.object({
  token: z.string().min(10).max(2048),
  password: passwordFieldSchema,
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", {
        ip,
        path: "/api/auth/reset-password",
        method: "POST",
      });
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request" },
        { status: 400 }
      );
    }
    const { token, password } = parsed.data;

    const strength = await checkPassword(password);
    if (!strength.ok) {
      return NextResponse.json(
        { success: false, message: passwordStrengthMessage(strength) },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });

    if (verifyError || !verifyData?.session || !verifyData.user?.id) {
      logSecurityEvent("auth_failure", {
        ip,
        path: "/api/auth/reset-password",
        detail: "invalid_or_expired_recovery_token",
      });
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset link." },
        { status: 401 }
      );
    }

    const userId = verifyData.user.id;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      reportServerError(new Error(updateError.message), {
        path: "/api/auth/reset-password",
        method: "POST",
        userId,
      });
      return NextResponse.json(
        { success: false, message: "Could not update password." },
        { status: 500 }
      );
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    if (signOutError) {
      reportServerError(new Error(signOutError.message), {
        path: "/api/auth/reset-password",
        method: "POST",
        userId,
        extra: { step: "global_sign_out" },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Password updated. Please sign in with your new password.",
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/auth/reset-password",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, message: "Unexpected error.", incidentId },
      { status: 500 }
    );
  }
}
