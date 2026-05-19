# Email Not Receiving - Debugging Guide

## Common Issues & Solutions

### 1. ✅ Check Environment Variables

The email system requires these environment variables in your `.env.local` file:

```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_EMAIL_NO_REPLY=noreply@mg.yourdomain.com (optional)
JWT_SECRET=your_jwt_secret_here
HARVEST_21_LOGO=https://yourdomain.com/logo.png (optional)
```

**How to Check**:
1. Open your `.env.local` file in the project root
2. Verify all variables are present and have values
3. Make sure there are NO quotes around the values
4. Make sure there are NO spaces around the `=` sign

**Example CORRECT**:
```env
MAILGUN_API_KEY=1a2b3c4d5e6f7g8h9i0j
MAILGUN_DOMAIN=mg.harvest21.com
JWT_SECRET=my-super-secret-key-change-in-production
```

**Example WRONG**:
```env
MAILGUN_API_KEY = "1a2b3c4d5e6f7g8h9i0j"  ❌ (has spaces and quotes)
MAILGUN_DOMAIN=                           ❌ (empty value)
```

### 2. 🔍 Check Server Logs

When you click "Send Invite", check your terminal/console for these logs:

**✅ GOOD - Email sending successfully**:
```
🔧 Mailgun Config Check (Activation Email):
- API Key exists: true
- Domain: mg.yourdomain.com
- From Email: noreply@mg.yourdomain.com
- Logo: https://...

📧 Sending activation email via Mailgun: https://api.mailgun.net/v3/mg.yourdomain.com/messages
- From: noreply@mg.yourdomain.com
- To: user@example.com
- Activation URL: http://localhost:3000/welcome?token=...

✅ Activation email sent successfully: <message-id>
```

**❌ BAD - Missing configuration**:
```
🔧 Mailgun Config Check (Activation Email):
- API Key exists: false  ❌
- Domain: undefined      ❌
```

**❌ BAD - Mailgun API error**:
```
❌ Mailgun API error (Activation Email):
- Status: 401 Unauthorized
- Response: Forbidden - No permission to send from this domain
```

### 3. 🔑 Verify Mailgun API Key

**Steps**:
1. Go to https://app.mailgun.com
2. Login to your account
3. Go to **Settings** > **API Keys**
4. Copy your **Private API Key** (starts with `key-...`)
5. Paste it in `.env.local` as `MAILGUN_API_KEY`

**Common Mistakes**:
- Using the **Public** API key instead of **Private** ❌
- Copy-pasting with extra spaces ❌
- Using an expired or revoked key ❌

### 4. 🌐 Verify Mailgun Domain

**Steps**:
1. Go to https://app.mailgun.com
2. Go to **Sending** > **Domains**
3. Find your domain (e.g., `mg.yourdomain.com`)
4. Status should be **Verified** ✅

**If NOT Verified**:
- Click on the domain
- Follow the DNS setup instructions
- Add the required DNS records to your domain
- Wait for verification (can take 24-48 hours)

**Using Mailgun Sandbox Domain**:
- Mailgun provides a sandbox domain for testing
- Format: `sandbox[random].mailgun.org`
- **LIMITATION**: Can only send to **authorized recipients**
- You must add recipient emails in Mailgun dashboard first

**To add authorized recipients** (for sandbox):
1. Go to **Sending** > **Domains** > Click your sandbox domain
2. Scroll to **Authorized Recipients**
3. Click **Add Recipient**
4. Enter the email address you want to test with
5. Verify the email (check inbox for verification link)

### 5. 📧 Check Spam/Junk Folder

Emails from new Mailgun accounts often go to spam initially.

**Steps**:
1. Check your **Spam** or **Junk** folder
2. Mark the email as "Not Spam"
3. Add `noreply@mg.yourdomain.com` to your contacts

**Why emails go to spam**:
- New domain with no sending reputation
- No SPF/DKIM records configured
- Using sandbox domain
- Low email volume (triggers spam filters)

### 6. 🔄 Restart Development Server

Environment variables are loaded when the server starts.

**Steps**:
```bash
# Stop the dev server (Ctrl+C)
# Start it again
npm run dev
```

**Important**: Any changes to `.env.local` require a server restart!

### 7. 🧪 Test Email Sending Manually

Create a test file to check if Mailgun is working:

**test-email.js**:
```javascript
const fetch = require('node-fetch');

const MAILGUN_API_KEY = 'your_api_key_here';
const MAILGUN_DOMAIN = 'mg.yourdomain.com';

async function testEmail() {
  const formData = new FormData();
  formData.append('from', `noreply@${MAILGUN_DOMAIN}`);
  formData.append('to', 'your-email@example.com');
  formData.append('subject', 'Test Email');
  formData.append('text', 'This is a test email from Mailgun');

  const response = await fetch(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
      },
      body: formData,
    }
  );

  const result = await response.json();
  console.log('Response:', result);
}

testEmail();
```

Run: `node test-email.js`

### 8. 🔍 Check Mailgun Logs

**Steps**:
1. Go to https://app.mailgun.com
2. Go to **Sending** > **Logs**
3. Look for your recent send attempts
4. Check the status:
   - **Accepted** ✅ - Mailgun accepted the email
   - **Delivered** ✅ - Email was delivered to recipient
   - **Failed** ❌ - Check the error message
   - **Rejected** ❌ - Mailgun rejected the email

**Common errors in logs**:
- `550 Requested action not taken: mailbox unavailable` - Email doesn't exist
- `Domain is not allowed to send` - Domain not verified
- `Forbidden` - API key issue

### 9. ⚙️ Verify Your Setup

**Quick Checklist**:
- [ ] `.env.local` file exists in project root
- [ ] `MAILGUN_API_KEY` is set (Private key)
- [ ] `MAILGUN_DOMAIN` is set (e.g., mg.yourdomain.com)
- [ ] `JWT_SECRET` is set (any secure random string)
- [ ] Domain is verified in Mailgun dashboard
- [ ] If using sandbox, recipient email is authorized
- [ ] Development server was restarted after adding env vars
- [ ] Console shows "API Key exists: true"
- [ ] Console shows "✅ Activation email sent successfully"

### 10. 🎯 Common Error Messages

#### "Mailgun configuration missing"
**Cause**: Environment variables not set
**Fix**: Add `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` to `.env.local`

#### "401 Unauthorized"
**Cause**: Invalid API key
**Fix**: 
- Check you're using the **Private** API key
- Verify no extra spaces when copying
- Generate a new API key if needed

#### "Forbidden - No permission to send from this domain"
**Cause**: Domain not verified or sandbox restrictions
**Fix**:
- Verify your domain in Mailgun
- Or add recipient to authorized list (sandbox only)

#### "Failed to send activation email"
**Cause**: Network error or Mailgun service issue
**Fix**:
- Check your internet connection
- Check Mailgun status: https://status.mailgun.com
- Try again in a few minutes

### 11. 📝 Step-by-Step Email Flow

When you click "Send Invite", here's what happens:

```
1. User clicks "Send Invite" button
   ↓
2. handleSendInvite() is called
   ↓
3. resendActivationEmail() server action runs
   ↓
4. Fetches missionary details from database
   ↓
5. generateActivationToken() creates JWT token
   ↓
6. sendActivationEmail() is called
   ↓
7. Checks if MAILGUN_API_KEY and MAILGUN_DOMAIN exist
   ↓
8. Builds activation URL: /welcome?token=...
   ↓
9. Generates HTML email template
   ↓
10. Sends POST request to Mailgun API
   ↓
11. Mailgun accepts the email
   ↓
12. Mailgun delivers email to recipient
   ↓
13. User receives email in inbox (or spam)
```

**Where it can fail**:
- **Step 7**: Missing environment variables
- **Step 10**: Invalid API key, wrong domain
- **Step 11**: Mailgun rejects (unverified domain)
- **Step 12**: Spam filters block email
- **Step 13**: Email goes to spam folder

### 12. 🔧 Quick Fix Commands

```bash
# 1. Check if .env.local exists
ls -la .env.local

# 2. Check environment variables are loaded (add to your code temporarily)
console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? 'SET' : 'NOT SET');
console.log('MAILGUN_DOMAIN:', process.env.MAILGUN_DOMAIN);

# 3. Restart server
# Press Ctrl+C to stop, then:
npm run dev

# 4. Check logs in terminal when clicking "Send Invite"
# You should see the Mailgun config logs
```

### 13. 🆘 Still Not Working?

If you've tried everything above and emails still aren't sending:

**Option 1: Use Mailgun Sandbox Domain (Testing)**
```env
MAILGUN_DOMAIN=sandbox1234567890abcdef.mailgun.org
```
- Go to Mailgun > Sending > Domains
- Click your sandbox domain
- Add your email to "Authorized Recipients"
- Verify your email
- Try sending again

**Option 2: Alternative Email Services**
Consider using:
- **SendGrid** (free tier: 100 emails/day)
- **AWS SES** (very reliable)
- **Resend** (developer-friendly)
- **Postmark** (great deliverability)

**Option 3: Debug Mode**
Add more logging to `lib/emailHelpers.ts`:
```typescript
console.log('📧 Full Mailgun request details:');
console.log('- URL:', mailgunUrl);
console.log('- API Key (first 10 chars):', MAILGUN_API_KEY?.substring(0, 10));
console.log('- Domain:', MAILGUN_DOMAIN);
console.log('- To:', email);
console.log('- From:', MAILGUN_FROM_EMAIL);
```

### 14. 💡 Pro Tips

**For Development**:
- Use a sandbox domain for testing
- Add your personal email as authorized recipient
- Check spam folder every time
- Keep Mailgun logs tab open

**For Production**:
- Use a verified custom domain
- Set up SPF, DKIM, and DMARC records
- Warm up your domain (send gradually increasing volumes)
- Monitor deliverability rates in Mailgun dashboard
- Use a dedicated IP address for better reputation

**Best Practices**:
- Use descriptive "from" names: `Harvest21 Team <noreply@mg.harvest21.com>`
- Include unsubscribe link (not needed for activation emails)
- Test emails before major deployments
- Monitor bounce rates and spam complaints

## 🎯 Most Likely Issues (Ordered by Probability)

1. **Missing or wrong environment variables** (80%)
2. **Domain not verified in Mailgun** (10%)
3. **Email going to spam** (5%)
4. **Using sandbox without authorizing recipient** (3%)
5. **Server not restarted after env changes** (2%)

## ✅ Final Checklist

Run through this checklist:

```
1. [ ] Open .env.local file
2. [ ] Verify MAILGUN_API_KEY is set (should start with "key-")
3. [ ] Verify MAILGUN_DOMAIN is set (e.g., mg.yourdomain.com)
4. [ ] Verify JWT_SECRET is set
5. [ ] Save the file
6. [ ] Restart dev server (Ctrl+C, then npm run dev)
7. [ ] Create or send invite to a missionary
8. [ ] Check terminal for "✅ Activation email sent successfully"
9. [ ] Check recipient's inbox
10. [ ] Check recipient's spam/junk folder
11. [ ] Check Mailgun logs at https://app.mailgun.com
```

If you complete this checklist and still have issues, the problem is likely with your Mailgun account setup, not the code.

