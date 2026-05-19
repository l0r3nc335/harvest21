# Email Activation System Setup

This document explains the email activation system for new missionaries in Harvest21.

## Overview

When a new missionary is created through the admin form, the system:
1. Creates a user account with a temporary password
2. Generates a secure activation token (JWT)
3. Sends an activation email via Mailgun with a link
4. User clicks the link and sets their password
5. Account is activated and ready to use

## Required Environment Variables

Add these to your `.env.local` file:

```env
# App URL (OPTIONAL - automatically detects environment)
# Local: http://localhost:3000
# Production: https://harvest21.com
# Only set this to override automatic detection
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Mailgun Configuration (REQUIRED)
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# JWT Secret (REQUIRED - for activation tokens)
JWT_SECRET=your_secure_jwt_secret_key_change_this_in_production
```

### 🌐 Automatic Environment Detection

The system automatically detects the environment and uses the appropriate URL:

- **Development** (`NODE_ENV=development`): Uses `http://localhost:3000`
- **Production** (`NODE_ENV=production`): Uses `https://harvest21.com`
- **Custom**: Set `NEXT_PUBLIC_APP_URL` to override automatic detection

This means you don't need to change any code or environment variables when deploying to production!

### How to Get Mailgun Credentials

1. Sign up at https://mailgun.com
2. Go to Sending > Domains
3. Copy your domain name (e.g., `mg.yourdomain.com`)
4. Go to Settings > API Keys
5. Copy your Private API key

## File Structure

### Email Template
- `lib/emailTemplates.ts` - HTML email template generator

### Token Management
- `lib/tokenHelpers.ts` - JWT token generation and verification

### API Routes
- `app/api/send-activation-email/route.ts` - Sends activation email via Mailgun
- `app/api/verify-activation-token/route.ts` - Verifies token validity
- `app/api/activate-account/route.ts` - Updates user password and activates account

### Pages & Components
- `app/welcome/page.tsx` - Activation landing page (server component)
- `components/auth/WelcomePageContent.tsx` - Password setup form (client component)

### Integration
- `app/admin/missionaries/actions.ts` - Updated to send activation email after user creation

## How It Works

### 1. Creating a Missionary

When an admin creates a new missionary:

```typescript
// app/admin/missionaries/actions.ts
const activationToken = await generateActivationToken(userId, email);

await fetch("/api/send-activation-email", {
  method: "POST",
  body: JSON.stringify({
    email,
    userName: `${firstName} ${lastName}`,
    activationToken,
  }),
});
```

### 2. Email Sent

User receives an email with:
- Harvest21 branding
- Personalized greeting
- List of features
- "Activate My Account" button linking to:
  `https://yourapp.com/welcome?token=<jwt_token>`

### 3. User Clicks Link

- Token is validated on the welcome page
- If valid, user sees password setup form
- If invalid/expired, user sees error message

### 4. Setting Password

User submits new password:
- Password must be at least 8 characters
- Passwords must match
- Backend updates password using Supabase Admin API
- User is redirected to home page

## Security Features

### JWT Tokens
- Signed with HS256 algorithm
- 72-hour expiration (configurable)
- Contains: userId, email, type (activation)
- Verified before any action

### Password Requirements
- Minimum 8 characters
- Server-side validation
- Updated via Admin API (bypasses auth state issues)

### Email Validation
- Token includes email address
- Verified against user record
- Prevents unauthorized activation

## Customization

### Email Template

Edit `lib/emailTemplates.ts` to customize:
- Branding and colors
- Email content
- Social media links
- Footer text

### Token Expiration

Edit `lib/tokenHelpers.ts`:

```typescript
export async function generateActivationToken(
  userId: string,
  email: string,
  expiresInHours: number = 72  // Change this value
): Promise<string>
```

### Redirect After Activation

Edit `components/auth/WelcomePageContent.tsx`:

```typescript
setTimeout(() => {
  router.push("/dashboard");  // Change redirect destination
}, 1500);
```

## Testing

### Local Testing

1. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`
2. Use Mailgun sandbox domain for testing
3. Add authorized recipients in Mailgun dashboard

### Production

1. Set `NEXT_PUBLIC_APP_URL` to your production domain
2. Use verified Mailgun domain
3. Update `JWT_SECRET` to a strong secret key

## Troubleshooting

### Email Not Sending

Check:
- Mailgun credentials are correct
- Domain is verified in Mailgun
- API key has proper permissions
- Check server logs for Mailgun API errors

### Invalid Token Error

Check:
- Token hasn't expired (72 hours)
- `JWT_SECRET` is the same across all environments
- Token wasn't modified in URL

### Password Not Updating

Check:
- Supabase Admin API credentials
- User exists in auth.users table
- Check server logs for error messages

## Support

For issues or questions:
- Email: support@harvest21.com
- Check server logs in Next.js console
- Check Mailgun dashboard for delivery status

