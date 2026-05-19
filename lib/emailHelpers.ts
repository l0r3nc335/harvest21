import { generateActivationEmailHTML, generateActivationEmailText } from "@/lib/emailTemplates";
import { getBaseUrl } from "@/lib/envHelpers";
import { sendEmailWithGmail } from "@/lib/gmailMailerService";

const HARVEST_21_LOGO = process.env.HARVEST_21_LOGO;

export async function sendActivationEmail(
  email: string,
  userName: string,
  activationToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const activationUrl = `${getBaseUrl()}/welcome?token=${encodeURIComponent(activationToken)}`;
    const emailHTML = generateActivationEmailHTML(userName, activationUrl, HARVEST_21_LOGO);
    const emailText = generateActivationEmailText(userName, activationUrl);

    console.log("📧 Sending activation email via Gmail SMTP");
    console.log("- To:", email);
    console.log("- Activation URL:", activationUrl);

    const result = await sendEmailWithGmail({
      to: email,
      subject: "Welcome to Harvest21 - Activate Your Account",
      text: emailText,
      html: emailHTML,
    });

    if (!result.success) {
      console.error("❌ Failed to send activation email:", result.error);
      return {
        success: false,
        error: result.error
      };
    }

    console.log("✅ Activation email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending activation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

