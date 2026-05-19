# Testing the Email Activation Flow

## Prerequisites

Before testing, ensure you have:

1. ✅ Mailgun account created
2. ✅ Domain verified in Mailgun
3. ✅ Environment variables set in `.env.local`:

```env
# NEXT_PUBLIC_APP_URL is optional - auto-detects localhost:3000 in dev
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
JWT_SECRET=your_secret_key_minimum_32_characters
```

**Note**: The URL automatically switches between `localhost:3000` (dev) and `https://harvest21.com` (production)

## Step-by-Step Testing

### 1. Start Your Development Server

```bash
npm run dev
```

Server should be running at `http://localhost:3000`

### 2. Login as Admin

Navigate to your admin panel and log in with admin credentials.

### 3. Create a New Missionary

1. Go to `/admin/missionaries` or wherever your missionary creation form is
2. Click "Create New Missionary" or similar button
3. Fill out the form with test data:
   - **First Name**: Test
   - **Last Name**: Missionary
   - **Email**: your-test-email@gmail.com (use your real email for testing)
   - **Phone Number**: +1234567890
   - Fill in all other required fields
4. Click "Save" or "Create"

### 4. Check Server Console

You should see logs indicating:
```
✓ Missionary created
✓ Token generated
✓ Email API called
```

### 5. Check Your Email Inbox

Look for an email with:
- Subject: "Welcome to Harvest21 - Activate Your Account"
- From: noreply@yourdomain.com
- Should match the design in the screenshot provided

### 6. Click "Activate My Account" Button

You'll be redirected to:
```
http://localhost:3000/welcome?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 7. Verify Welcome Page Loads

You should see:
- ✅ Welcome to Harvest21! header
- ✅ Email address displayed (disabled input)
- ✅ New Password field
- ✅ Confirm Password field
- ✅ "Activate Account" button

### 8. Set Your Password

1. Enter a password (minimum 8 characters)
2. Re-enter the same password in confirmation field
3. Click "Activate Account"

### 9. Verify Success

You should see:
- ✅ Success toast: "Account activated successfully! Redirecting..."
- ✅ Automatic redirect to homepage after 1.5 seconds

### 10. Test Login

1. Try logging in with:
   - Email: the email you used
   - Password: the password you just set
2. Login should succeed ✅

## Common Issues and Solutions

### Issue: Email Not Received

**Check:**
- [ ] Mailgun credentials are correct
- [ ] Email is in spam folder
- [ ] Mailgun sandbox domain has authorized recipients
- [ ] Check Mailgun dashboard logs

**Solution:**
```bash
# Check server logs for errors
# Look for: "Failed to send email" or Mailgun API errors
```

### Issue: Invalid Token Error

**Check:**
- [ ] JWT_SECRET is set in .env.local
- [ ] Token hasn't expired (72 hours)
- [ ] URL wasn't truncated when copying

**Solution:**
Try generating a new user to get a fresh token

### Issue: Password Not Updating

**Check:**
- [ ] SUPABASE_SERVICE_ROLE_KEY is set
- [ ] User exists in Supabase auth.users table
- [ ] Check browser console for API errors

**Solution:**
Check Supabase dashboard to verify user was created

### Issue: Page Shows "Invalid Activation Link"

**Reasons:**
- Token expired (>72 hours old)
- Token signature invalid
- JWT_SECRET changed after token generation
- Token was modified in URL

**Solution:**
Create a new missionary to generate a fresh token

## Testing Edge Cases

### Test 1: Expired Token

1. Generate a token
2. Wait 72+ hours (or modify `expiresInHours` in code to 1 minute)
3. Try to activate
4. Should see "Invalid or expired activation link" ❌

### Test 2: Password Mismatch

1. Enter different passwords in both fields
2. Click activate
3. Should see "Passwords do not match" toast ❌

### Test 3: Short Password

1. Enter password < 8 characters
2. Click activate
3. Should see "Password must be at least 8 characters long" ❌

### Test 4: Duplicate User

1. Create missionary with email test@example.com
2. Try creating another with same email
3. Should see error: "A user with this email already exists" ❌

### Test 5: Invalid Token in URL

1. Go to `/welcome?token=invalid_token_string`
2. Should see "Invalid Activation Link" page ❌

## Production Testing Checklist

Before deploying to production:

- [ ] ✅ No need to change `NEXT_PUBLIC_APP_URL` - auto-detects production URL
- [ ] Use production Mailgun domain (not sandbox)
- [ ] Generate strong `JWT_SECRET` (minimum 32 characters)
- [ ] Test email delivery to various email providers (Gmail, Outlook, Yahoo)
- [ ] Verify all links in email work with production URL (https://harvest21.com)
- [ ] Test on mobile devices
- [ ] Check spam score of emails
- [ ] Monitor email delivery rate in Mailgun dashboard
- [ ] Set up email webhooks for bounce/complaint tracking

## Monitoring

### Metrics to Track

1. **Email Delivery Rate**
   - Check Mailgun dashboard
   - Track bounces and complaints

2. **Activation Rate**
   - % of users who activate within 24 hours
   - % of users who activate within 72 hours

3. **Error Rates**
   - Token validation failures
   - Password update failures
   - Email send failures

### Logs to Check

```bash
# Server logs
npm run dev

# Look for:
- "Email sent successfully" or errors
- "Token generated for user: xxx"
- "Account activated for user: xxx"
```

## Support

If you encounter issues:

1. Check server logs (Next.js console)
2. Check browser console (F12)
3. Check Mailgun dashboard logs
4. Check Supabase logs
5. Review `.env.local` configuration

For additional help:
- 📧 Email: support@harvest21.com
- 📖 Documentation: See EMAIL_ACTIVATION_SETUP.md

