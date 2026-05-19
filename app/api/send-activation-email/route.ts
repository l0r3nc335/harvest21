import { NextRequest, NextResponse } from "next/server";
import { sendActivationEmail } from "@/lib/emailHelpers";
import { requireAuth } from "@/lib/apiAuth";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { sendActivationEmailSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";

export async function POST(request: NextRequest) {
  try {
    // Security: rate limit email sends
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "email");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/send-activation-email", method: "POST" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    // Security: require authentication (admin-only endpoint)
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const parsed = parseBody(sendActivationEmailSchema, body);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/send-activation-email", detail: parsed.error });
      return NextResponse.json({ success: false, message: "Invalid input" }, { status: 400 });
    }
    const { email, userName, activationToken } = parsed.data;

    const result = await sendActivationEmail(email, userName, activationToken);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Failed to send email",
          error: result.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Error in activation email API:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while sending the email" },
      { status: 500 }
    );
  }
}

