function createEmailButton(url: string, text: string): string {
  const escapedUrl = url.replace(/&/g, "&amp;");

  return `
<!--[if mso]>
<table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <v:roundrect
        xmlns:v="urn:schemas-microsoft-com:vml"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        href="${escapedUrl}"
        style="height:48px;v-text-anchor:middle;width:220px;"
        arcsize="14%"
        stroke="f"
        fillcolor="#fbbf24"
      >
        <w:anchorlock/>
        <center>
          <a
            href="${escapedUrl}"
            style="color:#000000;font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;mso-line-height-rule:exactly;"
          >
            ${text}
          </a>
        </center>
      </v:roundrect>
    </td>
  </tr>
</table>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
  <tr>
    <td align="center" bgcolor="#fbbf24" style="border-radius:6px;">
      <a
        href="${escapedUrl}"
        target="_blank"
        style="background-color:#fbbf24;border-radius:6px;color:#000000;display:inline-block;font-family:Arial,sans-serif;font-size:16px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;width:220px;-webkit-text-size-adjust:none;"
      >
        ${text}
      </a>
    </td>
  </tr>
</table>
<!--<![endif]-->
`;
}

export function generateActivationEmailHTML(
  userName: string,
  activationUrl: string,
  logoUrl?: string
): string {
  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Welcome to Harvest21</title>
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="Harvest21" width="250" height="60" border="0" style="max-height: 60px; max-width: 250px; width: auto; height: auto; display: block; object-fit: contain;" />`
                : `<h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 600; letter-spacing: 1px;">
                     <span style="color: #60a5fa;">H</span>arvest
                   </h1>`
              }
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                      Welcome to Harvest21
                    </h2>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #111827; line-height: 1.5;">
                      Hello ${userName},
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                      You've been invited to join Harvest21, a global platform connecting missionaries with their sending churches, supporters, and mission partners.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                      Through your Harvest21 account, you can:
                    </p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 16px; color: #4b5563; line-height: 1.8;">
                      <li>Share ministry updates and prayer requests.</li>
                      <li>Connect with supporters and sending churches.</li>
                      <li>Manage your profile and ministry details in one place.</li>
                    </ul>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                      Your account is waiting – activate it now to get started.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px 0; text-align: center;">
                    ${createEmailButton(activationUrl, "Activate My Account")}
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      If you have any questions or need assistance, feel free to reply to this email or contact our support team at <a href="mailto:support@harvest21.com" style="color: #3b82f6; text-decoration: none;">support@harvest21.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 10px;">
                          <a href="https://instagram.com/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            📷
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://twitter.com/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            🐦
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://linkedin.com/company/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            💼
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://harvest21.com" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            🌐
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Copyright © 2023 Harvest21
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateActivationEmailText(
  userName: string,
  activationUrl: string
): string {
  return `
Hello ${userName},

Welcome to Harvest21! Please activate your account by clicking the link below:

${activationUrl}

If the link doesn't work, copy and paste it into your browser.

If you didn't create an account with Harvest21, you can safely ignore this email.

Best regards,
The Harvest21 Team
  `.trim();
}

export function generateResetPasswordEmailHTML(
  userName: string,
  resetUrl: string,
  logoUrl?: string
): string {
  return `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Reset Your Password - Harvest21</title>
  <!--[if mso]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center;">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="Harvest21" width="250" height="60" border="0" style="max-height: 60px; max-width: 250px; width: auto; height: auto; display: block; object-fit: contain;" />`
                : `<h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 600; letter-spacing: 1px;">
                     <span style="color: #60a5fa;">H</span>arvest
                   </h1>`
              }
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                      Reset Your Password
                    </h2>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #111827; line-height: 1.5;">
                      Hello ${userName},
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #4b5563; line-height: 1.6;">
                      We received a request to reset your password for your Harvest21 account. Click the button below to set a new password.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px 0; text-align: center;">
                    ${createEmailButton(resetUrl, "Reset My Password")}
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      This password reset link will expire in 1 hour for security reasons.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      If you have any questions or need assistance, contact our support team at <a href="mailto:support@harvest21.com" style="color: #3b82f6; text-decoration: none;">support@harvest21.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 10px;">
                          <a href="https://instagram.com/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            📷
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://twitter.com/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            🐦
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://linkedin.com/company/harvest21" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            💼
                          </a>
                        </td>
                        <td style="padding: 0 10px;">
                          <a href="https://harvest21.com" style="display: inline-block; width: 32px; height: 32px; background-color: #e5e7eb; border-radius: 50%; text-align: center; line-height: 32px; color: #6b7280; text-decoration: none; font-size: 18px;">
                            🌐
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Copyright © 2023 Harvest21
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateResetPasswordEmailText(
  userName: string,
  resetUrl: string
): string {
  return `
Hello ${userName},

We received a request to reset your password for your Harvest21 account.

To reset your password, please visit the following link:
${resetUrl}

This password reset link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

If you have any questions or need assistance, contact our support team at support@harvest21.com

Best regards,
The Harvest21 Team

Copyright © 2023 Harvest21
  `.trim();
}