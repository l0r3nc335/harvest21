import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getServiceRoleSupabase } from "@/lib/supabaseServiceRoleClient";
import { changePasswordSchema, parseBody } from "@/lib/validations";
import { checkPassword, passwordStrengthMessage } from "@/lib/passwordSecurity";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityLogger";
import { reportServerError } from "@/lib/errorReporting";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "auth");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", {
        ip,
        path: "/api/auth/change-password",
        method: "POST",
      });
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const supabaseSession = await getSupabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabaseSession.auth.getUser();

    if (userError || !user?.id || !user.email) {
      return NextResponse.json(
        { success: false, message: "You must be signed in to change your password." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseBody(changePasswordSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { success: false, message: "Server configuration error." },
        { status: 500 }
      );
    }

    const ephemeral = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error: signInError } = await ephemeral.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      logSecurityEvent("auth_failure", {
        ip,
        path: "/api/auth/change-password",
        detail: "invalid_current_password",
      });
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const strength = await checkPassword(newPassword);
    if (!strength.ok) {
      return NextResponse.json(
        { success: false, message: passwordStrengthMessage(strength) },
        { status: 400 }
      );
    }

    const admin = getServiceRoleSupabase();
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      reportServerError(new Error(updateError.message), {
        path: "/api/auth/change-password",
        method: "POST",
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, message: "Could not update password." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/auth/change-password",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, message: "Unexpected error.", incidentId },
      { status: 500 }
    );
  }
}
