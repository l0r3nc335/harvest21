import { sendEmailWithGmail } from "@/lib/gmailMailerService";
import type { WebhookAdminClient } from "@/lib/webhookAdminClient";
import { escapeHtml } from "@/lib/donationHelpers";

const HARVEST21_EIN = process.env.HARVEST21_EIN || "99-1234567";

export async function resolvedonorInfo(
  supabase: WebhookAdminClient,
  userId: string
): Promise<{ firstName: string; lastName: string; email: string } | null> {
  if (!userId) return null;

  const { data: donor } = await supabase
    .from("donors")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (donor?.email) {
    return { firstName: donor.first_name, lastName: donor.last_name, email: donor.email };
  }

  const { data: supporter } = await supabase
    .from("supporter_profiles")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (supporter?.email) {
    return { firstName: supporter.first_name, lastName: supporter.last_name, email: supporter.email };
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (userRow?.email) {
    return {
      firstName: userRow.first_name || "",
      lastName: userRow.last_name || "",
      email: userRow.email,
    };
  }

  return null;
}

function buildReceiptHtml(
  donorName: string,
  amountDollars: number,
  designation: string | null,
  receiptNumber: string,
  donationDate: string,
  logoUrl: string
): string {
  const designationRow = designation
    ? `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Designation</td>
        <td style="padding:12px 0;color:#333;font-size:14px;">${designation}</td>
      </tr>`
    : "";
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f3f4f6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#000000;padding:30px;">
    ${logoUrl
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><img src="${logoUrl}" alt="Harvest21" border="0" style="max-height:60px;max-width:250px;width:auto;height:auto;display:block;" /></td></tr></table>`
      : `<h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:600;letter-spacing:1px;text-align:center;"><span style="color:#60a5fa;">H</span>arvest</h1>`}
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#D3AF37;margin:0 0 16px;">Donation Receipt</h2>
    <p style="color:#333;margin:0 0 8px;">Dear ${donorName},</p>
    <p style="color:#333;margin:0 0 24px;">Thank you for your donation.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;width:40%;">Receipt Number</td>
        <td style="padding:12px 0;color:#333;font-size:14px;font-weight:600;">${receiptNumber}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Dates</td>
        <td style="padding:12px 0;color:#333;font-size:14px;">${donationDate}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 0;color:#666;font-size:14px;">Amount</td>
        <td style="padding:12px 0;color:#333;font-size:14px;font-weight:600;">$${amountDollars.toFixed(2)} USD</td>
      </tr>
      ${designationRow}
      <tr>
        <td style="padding:12px 0;color:#666;font-size:14px;">EIN</td>
        <td style="padding:12px 0;color:#333;font-size:14px;">${HARVEST21_EIN}</td>
      </tr>
    </table>
    <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:0 0 16px;">
      <p style="font-size:12px;color:#6b7280;margin:0 0 8px;line-height:1.5;">
        <strong>IRS Disclosure:</strong> No goods or services were provided in exchange for this contribution.
      </p>
      <p style="font-size:12px;color:#6b7280;margin:0 0 8px;line-height:1.5;">
        This contribution was designated to support ministry through Harvest 21.
      </p>
      <p style="font-size:12px;color:#6b7280;margin:0;line-height:1.5;">
        Harvest 21 is a qualified IRS Section 501(c)(3) tax-exempt organization (EIN: ${HARVEST21_EIN}). All donations are tax-deductible to the fullest extent allowed by law. Please retain this receipt for your tax records.
      </p>
    </div>
    <p style="font-size:11px;color:#9ca3af;margin:0;">This is an official charitable contribution receipt for tax purposes.</p>
  </td></tr>
  <tr><td style="background-color:#000000;padding:20px;text-align:center;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">© ${new Date().getFullYear()} Harvest 21. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendDonationReceiptEmail(
  supabase: WebhookAdminClient,
  userId: string,
  donorId: number | null,
  amountDollars: number,
  _pageId: number,
  receiptNumber: string,
  donationId: number,
  designation?: string
) {
  const { data: sentRows } = await supabase
    .from("donation_receipts")
    .select("id")
    .eq("page_donation_id", donationId)
    .not("sent_at", "is", null)
    .limit(1);
  if (sentRows && sentRows.length > 0) {
    return;
  }

  const { data: donation } = await supabase
    .from("page_donations")
    .select("designation, donor_first_name, donor_last_name")
    .eq("id", donationId)
    .maybeSingle();

  console.log("[donation-receipt-email] start", {
    donationId,
    receiptNumber,
    designationParam: designation,
    designationParamType: typeof designation,
    userId: userId || "(empty)",
    donorId,
  });

  let donorInfo: { firstName: string; lastName: string; email: string } | null;
  if (userId) {
    donorInfo = await resolvedonorInfo(supabase, userId);
  } else if (donorId) {
    const { data: donor } = await supabase
      .from("donors")
      .select("first_name, last_name, email")
      .eq("id", donorId)
      .maybeSingle();
    donorInfo = donor?.email
      ? { firstName: donor.first_name ?? "", lastName: donor.last_name ?? "", email: donor.email }
      : null;
  } else {
    donorInfo = null;
  }
  if (!donorInfo) {
    console.log("[donation-receipt-email] abort: no donorInfo (cannot resolve email)", {
      donationId,
      userId: userId || "(empty)",
      donorId,
    });
    return;
  }
  console.log("[donation-receipt-email] donor resolved", {
    donationId,
    to: donorInfo.email,
    donorFirstName: donorInfo.firstName,
    donorLastName: donorInfo.lastName,
  });

  const donationDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const trimmedParam = (designation ?? "").trim();
  const trimmedDb =
    donation?.designation != null && String(donation.designation).trim() !== ""
      ? String(donation.designation).trim()
      : "";
  const resolvedDesignation = (trimmedParam || trimmedDb).slice(0, 50);

  console.log("[donation-receipt-email] designation resolution", {
    donationId,
    paramDesignation: designation,
    resolvedDesignation,
  });
  const logoUrl = process.env.HARVEST_21_LOGO || "";
  const fromDonationRow = [donation?.donor_first_name, donation?.donor_last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  const fromResolvedDonor = `${donorInfo.firstName} ${donorInfo.lastName}`.trim();
  const rowTokens = fromDonationRow.split(/\s+/).filter(Boolean);
  const resolvedTokens = fromResolvedDonor.split(/\s+/).filter(Boolean);
  const rawDonorName =
    fromDonationRow &&
    rowTokens.length === 1 &&
    resolvedTokens.length >= 2
      ? fromResolvedDonor
      : fromDonationRow || fromResolvedDonor || "Supporter";
  const donorName = escapeHtml(rawDonorName);
  const safeDesignation = resolvedDesignation ? escapeHtml(resolvedDesignation) : null;

  console.log("[donation-receipt-email] html input", {
    donationId,
    donorNameSnippet: rawDonorName.slice(0, 80),
    safeDesignation,
    receiptNumber,
  });

  const html = buildReceiptHtml(donorName, amountDollars, safeDesignation, receiptNumber, donationDate, logoUrl);
  const designationCellMatch = html.match(/Designation<\/td>\s*<td[^>]*>([^<]*)/i);
  console.log("[donation-receipt-email] built html, calling sendEmailWithGmail", {
    donationId,
    to: donorInfo.email,
    subject: `Harvest 21 — Donation Receipt #${receiptNumber}`,
    htmlLength: html.length,
    designationCellInHtml: designationCellMatch?.[1]?.trim() ?? "(no Designation row / no match)",
    safeDesignationBeforeBuild: safeDesignation,
  });

  const result = await sendEmailWithGmail({
    to: donorInfo.email,
    subject: `Harvest 21 — Donation Receipt #${receiptNumber}`,
    html,
  });
  const sent = result.success;

  console.log("[donation-receipt-email] sendEmailWithGmail finished", {
    donationId,
    receiptNumber,
    success: sent,
    messageId: result.messageId,
    error: result.error,
  });

  if (sent) {
    const { data: claimed } = await supabase
      .from("donation_receipts")
      .update({ sent_at: new Date().toISOString(), delivery_status: "sent" })
      .eq("page_donation_id", donationId)
      .is("sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      console.log("[donation-receipt-email] race skipped: already marked sent", {
        donationId,
      });
    }
  } else {
    await supabase
      .from("donation_receipts")
      .update({ delivery_status: "failed" })
      .eq("page_donation_id", donationId)
      .is("sent_at", null);
  }
}
