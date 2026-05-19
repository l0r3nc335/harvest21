import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { activateAccountSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";
import { reportServerError } from "@/lib/errorReporting";
import { checkPassword, passwordStrengthMessage } from "@/lib/passwordSecurity";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/activate-account", method: "POST" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = parseBody(activateAccountSchema, body);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", {
        ip,
        path: "/api/activate-account",
        detail: parsed.error,
      });
      return NextResponse.json({ success: false, message: "Invalid input" }, { status: 400 });
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
        path: "/api/activate-account",
        detail: "invalid_or_expired_activation_token",
      });
      return NextResponse.json(
        { success: false, message: "Invalid or expired activation link." },
        { status: 401 }
      );
    }

    const userId = verifyData.user.id;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      const { incidentId } = reportServerError(new Error(updateError.message), {
        path: "/api/activate-account",
        method: "POST",
        userId,
      });
      return NextResponse.json(
        { success: false, message: "Failed to update password", incidentId },
        { status: 500 }
      );
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    if (signOutError) {
      reportServerError(new Error(signOutError.message), {
        path: "/api/activate-account",
        method: "POST",
        userId,
        extra: { step: "global_sign_out" },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Account activated successfully. Please sign in with your new password.",
      email: verifyData.user.email ?? null,
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/activate-account",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, message: "Account activation failed", incidentId },
      { status: 500 }
    );
  }
}
