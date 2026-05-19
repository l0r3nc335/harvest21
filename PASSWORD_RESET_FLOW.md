# Password Reset Flow Documentation

## Overview

This document describes the complete "Forgot Password" flow implementation for Harvest21, including email sending via Mailgun and password reset functionality using Supabase Auth.

## Features Implemented

### 1. Forgot Password Flow
- User requests password reset by entering their email
- System verifies email exists in database
- Generates secure reset token via Supabase Auth
- Sends branded email via Mailgun
- Provides user feedback regardless of whether email exists (security best practice)

### 2. Email Template
- **HTML Version**: Fully styled, responsive email matching Harvest21 branding
  - Black header with blue accent "H" logo
  - Lock icon in yellow circle
  - Clear "Reset My Password" call-to-action button
  - Security notice about 1-hour expiration
  - Footer with social media links
  
- **Text Version**: Plain-text fallback for email clients that don't support HTML

### 3. Reset Password Page
- Token verification on page load
- Password strength requirements (minimum 8 characters)
- Password visibility toggle
- Real-time password match validation
- Success/error handling with toast notifications
- Automatic redirect to login after successful reset

## File Structure

```
app/
├── api/
│   └── send-reset-email/
│       └── route.ts                    # API endpoint for sending reset emails
├── forgot-password/
│   └── page.tsx                        # Forgot password page (server component)
├── reset-password/
│   └── page.tsx                        # Reset password page (server component)

components/
└── auth/
    ├── ForgotPasswordForm.tsx          # Client component for email input
    ├── ResetPasswordForm.tsx           # Client component for password reset
    └── LoginModal.tsx                  # Already has "Forgot password" link

lib/
└── emailTemplates.ts                   # Email templates (HTML + text)
```

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

## User Flow

### Step 1: Request Password Reset
1. User clicks "Forgot password" link on login modal
2. User is redirected to `/forgot-password`
3. User enters their email address
4. System sends reset email (if account exists)
5. Success message displayed regardless of email existence

### Step 2: Receive Email
1. User receives email from Harvest21
2. Email contains branded template with reset link
3. Link format: `https://yourapp.com/reset-password?token=<reset_token>`
4. Link expires in 1 hour

### Step 3: Reset Password
1. User clicks link in email
2. System verifies token using Supabase
3. If valid: Display password reset form
4. If invalid/expired: Show error with option to request new link
5. User enters new password (with confirmation)
6. System updates password in Supabase
7. User is logged out and redirected to home page

## Security Features

1. **Token-Based Reset**: Uses Supabase's secure recovery tokens
2. **Time Expiration**: Tokens expire in 1 hour
3. **Email Verification**: Only sends emails to existing accounts
4. **No User Enumeration**: Same response whether email exists or not
5. **Password Requirements**: Minimum 8 characters enforced
6. **Automatic Logout**: After password reset, user must log in again

## API Endpoints

### POST `/api/send-reset-email`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "If an account exists, a reset email has been sent",
  "messageId": "mailgun_message_id"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to send email"
}
```

## Testing the Flow

### Prerequisites
1. Ensure all environment variables are set
2. Mailgun account configured and verified
3. Supabase project with auth enabled
4. At least one test user in the database

### Test Steps

#### 1. Test Email Sending
```bash
# Navigate to forgot password page
http://localhost:3000/forgot-password

# Enter a valid email address
# Check email inbox for reset email
```

#### 2. Test Invalid Email
```bash
# Enter an email that doesn't exist
# Should still show success message (security feature)
# No email should be received
```

#### 3. Test Password Reset
```bash
# Click reset link from email
# Should see password reset form
# Enter new password and confirmation
# Submit form
# Should redirect to home page
```

#### 4. Test Token Expiration
```bash
# Wait 1 hour after receiving reset email
# Click expired link
# Should see error message
# Should have option to request new link
```

#### 5. Test Password Validation
```bash
# Try password less than 8 characters (should show error)
# Try non-matching passwords (should show error)
# Try valid password (should succeed)
```

## Customization Options

### Email Branding
Edit `/lib/emailTemplates.ts` to customize:
- Logo and header colors
- Button styles and colors
- Footer content and social media links
- Email copy and messaging

### Password Requirements
Edit `/components/auth/ResetPasswordForm.tsx` to change:
- Minimum password length
- Password complexity requirements
- Validation rules

### Token Expiration
Supabase handles token expiration (default: 1 hour)
To change, update in Supabase Dashboard: Authentication > Settings > Email Auth

### Styling
All components use TailwindCSS
Colors follow Harvest21 brand:
- Primary: `#FFD700` (yellow/gold)
- Accent: `#7BAFD4` (blue)
- Dark: `#1A1A1A` (near black)

## Troubleshooting

### Email Not Received
1. Check Mailgun dashboard for delivery status
2. Verify MAILGUN_API_KEY and MAILGUN_DOMAIN
3. Check spam folder
4. Ensure email exists in database

### Token Verification Failed
1. Check token in URL is complete (not truncated)
2. Verify token hasn't expired
3. Check Supabase auth configuration
4. Ensure SUPABASE_SERVICE_ROLE_KEY is correct

### API Errors
1. Check server logs for detailed error messages
2. Verify all environment variables are set
3. Ensure Supabase service role key has proper permissions
4. Check Mailgun API quota and status

## Production Checklist

- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Verify Mailgun sending domain is configured
- [ ] Test email delivery in production
- [ ] Ensure Supabase auth settings are production-ready
- [ ] Configure proper CORS settings if needed
- [ ] Set up email monitoring and alerts
- [ ] Test with real email addresses
- [ ] Verify mobile responsiveness of emails

## Future Enhancements

1. **Rate Limiting**: Prevent abuse by limiting reset requests per email
2. **SMS Verification**: Optional 2FA for password reset
3. **Password History**: Prevent reuse of recent passwords
4. **Custom Expiration**: Allow different expiration times
5. **Email Templates**: A/B test different email designs
6. **Analytics**: Track reset success rates
7. **Multi-language Support**: Internationalize email templates

## Support

For issues or questions:
- Email: support@harvest21.com
- Documentation: [Link to docs]
- GitHub Issues: [Link to repo]

