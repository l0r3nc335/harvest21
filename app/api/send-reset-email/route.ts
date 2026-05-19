import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateResetPasswordEmailHTML, generateResetPasswordEmailText } from "@/lib/emailTemplates";
import { getBaseUrl } from "@/lib/envHelpers";
import { sendEmailWithGmail } from "@/lib/gmailMailerService";
import { reportServerError } from "@/lib/errorReporting";

const HARVEST_21_LOGO = process.env.HARVEST_21_LOGO;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Security: rate limit password reset to prevent email flooding
    const { rateLimitCheck, getClientIp } = await import("@/lib/rateLimit");
    const { sendResetEmailSchema, parseBody } = await import("@/lib/validations");
    const { logSecurityEvent } = await import("@/lib/securityLogger");
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "email");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/send-reset-email", method: "POST" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const rawBody = await request.json();
    const parsed = parseBody(sendResetEmailSchema, rawBody);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/send-reset-email", detail: parsed.error });
      return NextResponse.json({ success: false, message: "Invalid input" }, { status: 400 });
    }
    const { email } = parsed.data;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return NextResponse.json(
        { success: true, message: "If an account exists, a reset email has been sent" },
        { status: 200 }
      );
    }

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
    });

    if (resetError || !resetData) {
      reportServerError(resetError ?? new Error("No reset data"), {
        path: "/api/send-reset-email",
        method: "POST",
      });
      // Do not reveal whether the account exists: return the same generic success.
      return NextResponse.json(
        { success: true, message: "If an account exists, a reset email has been sent" },
        { status: 200 }
      );
    }

    const resetToken = resetData.properties.hashed_token;
    const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;
    const fullName = user.first_name + " " + user.last_name;
    const emailHTML = generateResetPasswordEmailHTML(fullName || "User", resetUrl, HARVEST_21_LOGO);
    const emailText = generateResetPasswordEmailText(fullName || "User", resetUrl);

    const result = await sendEmailWithGmail({
      to: email,
      subject: "Reset Your Password - Harvest21",
      html: emailHTML,
      text: emailText,
    });

    if (!result.success) {
      reportServerError(new Error(result.error ?? "send failed"), {
        path: "/api/send-reset-email",
        method: "POST",
        extra: { step: "gmail_send" },
      });
      return NextResponse.json(
        { success: false, message: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists, a reset email has been sent",
    });
  } catch (error) {
    const { incidentId } = reportServerError(error, {
      path: "/api/send-reset-email",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, message: "An error occurred while sending the email", incidentId },
      { status: 500 }
    );
  }
}

