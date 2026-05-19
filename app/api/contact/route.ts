import { NextRequest, NextResponse } from "next/server";
import { sendEmailWithGmail } from "@/lib/gmailMailerService";
import { rateLimitCheck, getClientIp } from "@/lib/rateLimit";
import { contactSchema, parseBody } from "@/lib/validations";
import { logSecurityEvent } from "@/lib/securityLogger";

const CONTACT_EMAIL = "shared@harvest21.com";

export async function POST(request: NextRequest) {
  try {
    // Security: rate limit contact form to prevent spam/flooding
    const ip = getClientIp(request);
    const { success: withinLimit } = await rateLimitCheck(ip, "email");
    if (!withinLimit) {
      logSecurityEvent("rate_limit_hit", { ip, path: "/api/contact", method: "POST" });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = parseBody(contactSchema, body);
    if (!parsed.success) {
      logSecurityEvent("input_validation_failure", { ip, path: "/api/contact", detail: parsed.error });
      return NextResponse.json({ success: false, message: "Invalid input" }, { status: 400 });
    }
    const { name, email, message } = parsed.data;

    // Security: escape HTML entities to prevent XSS in email clients
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #000; padding: 20px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: #D3AF37; margin: 0;">New Contact Form Submission</h1>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${esc(name)}</p>
            <p><strong>Email:</strong> ${esc(email)}</p>
            <p><strong>Message:</strong></p>
            <p style="background-color: #fff; padding: 15px; border-left: 4px solid #D3AF37; margin-top: 10px;">
              ${esc(message).replace(/\n/g, "<br>")}
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
            <p>This message was sent from the Harvest21 contact form.</p>
          </div>
        </body>
      </html>
    `;

    const emailText = `
New Contact Form Submission

Name: ${name}
Email: ${email}

Message:
${message}

---
This message was sent from the Harvest21 contact form.
    `;

    const result = await sendEmailWithGmail({
      to: CONTACT_EMAIL,
      subject: `Contact Form: ${name}`,
      html: emailHTML,
      text: emailText,
      replyTo: email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Failed to send email", error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Error processing contact form:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while sending your message",
      },
      { status: 500 }
    );
  }
}
