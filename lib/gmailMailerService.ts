import nodemailer from "nodemailer";
import { reportServerError } from "@/lib/errorReporting";

const GMAIL_USER = process.env.GMAIL_USER || process.env.GMAIL_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;

function validateGmailConfig(): void {
  if (!GMAIL_USER) {
    throw new Error(
      "Gmail user environment variable is required but not set. Please add one of the following to your .env file: GMAIL_USER, GMAIL_EMAIL, EMAIL_USER, or SMTP_USER"
    );
  }
  if (!GMAIL_APP_PASSWORD) {
    throw new Error(
      "Gmail password environment variable is required but not set. Please add one of the following to your .env file: GMAIL_APP_PASSWORD, GMAIL_PASSWORD, EMAIL_PASSWORD, or SMTP_PASSWORD"
    );
  }
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  validateGmailConfig();

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmailWithGmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mailOptions = {
      from: GMAIL_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    };

    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    reportServerError(error, {
      extra: { service: "gmail_mailer", subject: options.subject },
    });
    return {
      success: false,
      error: "Email delivery failed",
    };
  }
}

