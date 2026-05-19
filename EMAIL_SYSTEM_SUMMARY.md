# Email Activation System - Quick Reference

## 🎯 What Was Built

A complete email activation system that sends branded activation emails to new missionaries and allows them to set their password.

## 📁 Files Created/Modified

### New Files Created:

1. **lib/emailTemplates.ts** - HTML email template matching your design
2. **lib/tokenHelpers.ts** - JWT token generation/verification
3. **app/api/send-activation-email/route.ts** - Mailgun email sender
4. **app/api/verify-activation-token/route.ts** - Token validator
5. **app/api/activate-account/route.ts** - Password updater
6. **app/welcome/page.tsx** - Activation landing page
7. **components/auth/WelcomePageContent.tsx** - Password setup form

### Modified Files:

1. **app/admin/missionaries/actions.ts** - Added email sending after user creation

## 🔄 Flow Diagram

```
Admin Creates Missionary
         ↓
User Account Created (Supabase)
         ↓
JWT Token Generated
         ↓
Email Sent via Mailgun
         ↓
User Clicks "Activate My Account"
         ↓
Redirected to /welcome?token=xxx
         ↓
Token Validated
         ↓
User Sets Password
         ↓
Account Activated
         ↓
Redirected to Homepage
```

## 🔑 Environment Variables Required

```env
# Optional - automatically detects environment
# Local: http://localhost:3000
# Production: https://harvest21.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Required - Mailgun configuration
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Required - JWT secret for tokens
JWT_SECRET=your_secure_jwt_secret_key
```

### 🌐 Automatic URL Detection

The system automatically uses the correct URL based on environment:
- **Local Development**: `http://localhost:3000`
- **Production**: `https://harvest21.com`
- **Custom**: Set `NEXT_PUBLIC_APP_URL` to override

## ✅ Features

- ✨ Beautiful HTML email matching your design
- 🔒 Secure JWT tokens (72-hour expiration)
- 🎨 Responsive welcome page
- 🔐 Password validation (min 8 characters)
- ⚡ Error handling and user feedback
- 📱 Mobile-friendly design
- 🛡️ Admin API for secure password updates

## 🚀 How to Test

1. Add environment variables to `.env.local`
2. Create a missionary through admin form
3. Check email  
4. Click "Activate My Account"
5. Set password
6. Log in with new credentials

## 📧 Email Template Features

- Harvest21 branding with blue "H"
- Avatar placeholder
- Welcome message
- Feature list
- Yellow activation button
- Social media links
- Copyright footer

## 🎨 Customization Points

### Change Token Expiration
`lib/tokenHelpers.ts` - Line 14: Change `72` to desired hours

### Change Email Design
`lib/emailTemplates.ts` - Edit HTML/CSS

### Change Redirect After Activation
`components/auth/WelcomePageContent.tsx` - Line 94: Change `router.push("/")`

### Change Password Requirements
`app/api/activate-account/route.ts` - Line 14: Modify validation

## 🔍 Debugging Tips

### Email not sending?
- Check Mailgun dashboard for logs
- Verify API credentials
- Check server console for errors

### Token invalid?
- Check token hasn't expired (72 hours)
- Verify JWT_SECRET is consistent
- Check browser URL for complete token

### Password not updating?
- Verify Supabase Admin credentials
- Check user exists in database
- Review server logs for errors

## 📝 Next Steps

1. ✅ Set up Mailgun account and verify domain
2. ✅ Add environment variables to `.env.local` and production
3. ✅ Test the complete flow locally
4. ✅ Customize email template if needed
5. ✅ Deploy to production
6. ✅ Monitor email delivery and activation rates

## 🛠️ Technical Stack

- **Email Service**: Mailgun
- **Token Security**: JWT (jose library)
- **Authentication**: Supabase Auth
- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS
- **UI Components**: Radix UI primitives

