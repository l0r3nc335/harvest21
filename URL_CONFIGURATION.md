# Automatic URL Configuration

## 🎯 How It Works

The system automatically detects which environment you're running in and uses the correct URL.

### Environment Detection Logic

```typescript
// lib/envHelpers.ts

export function getBaseUrl(): string {
  // 1. Check if custom URL is set (highest priority)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Check if running in production
  if (process.env.NODE_ENV === "production") {
    return "https://harvest21.com";
  }

  // 3. Default to localhost for development
  return "http://localhost:3000";
}
```

## 📋 Environment URLs

| Environment | NODE_ENV | URL Used |
|------------|----------|----------|
| Local Dev | `development` | `http://localhost:3000` |
| Production | `production` | `https://harvest21.com` |
| Custom | any | `NEXT_PUBLIC_APP_URL` value |

## 🚀 Usage Examples

### In Server Actions

```typescript
import { getApiUrl } from "@/lib/envHelpers";

const response = await fetch(getApiUrl("/api/send-activation-email"), {
  method: "POST",
  body: JSON.stringify(data),
});
```

### In API Routes

```typescript
import { getBaseUrl } from "@/lib/envHelpers";

const activationUrl = `${getBaseUrl()}/welcome?token=${token}`;
```

### In Client Components

```typescript
import { getBaseUrl } from "@/lib/envHelpers";

const baseUrl = getBaseUrl();
```

## 🔧 Configuration Options

### Option 1: Automatic (Recommended)

**No configuration needed!**

- Local: Automatically uses `http://localhost:3000`
- Production: Automatically uses `https://harvest21.com`

### Option 2: Custom URL Override

Set in `.env.local` or production environment variables:

```env
NEXT_PUBLIC_APP_URL=https://custom-domain.com
```

This will override automatic detection for all environments.

### Option 3: Different Production URL

If your production URL is different, edit `lib/envHelpers.ts`:

```typescript
if (process.env.NODE_ENV === "production") {
  return "https://your-production-url.com"; // Change this
}
```

## 🌍 Multi-Environment Setup

### Local Development

```env
# .env.local
# No NEXT_PUBLIC_APP_URL needed
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
JWT_SECRET=your_secret
```

**Result**: URLs use `http://localhost:3000`

### Staging Environment

```env
# .env.staging
NEXT_PUBLIC_APP_URL=https://staging.harvest21.com
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
JWT_SECRET=your_secret
```

**Result**: URLs use `https://staging.harvest21.com`

### Production Environment

```env
# Production environment variables (Vercel/Netlify/etc.)
# No NEXT_PUBLIC_APP_URL needed
MAILGUN_API_KEY=your_key
MAILGUN_DOMAIN=your_domain
JWT_SECRET=your_secret
```

**Result**: URLs use `https://harvest21.com`

## ✅ Benefits

1. **No manual configuration** - Works out of the box
2. **Environment-aware** - Automatically adapts to dev/prod
3. **Override capability** - Can customize when needed
4. **Single source of truth** - All URL logic in one place
5. **Deploy-ready** - No code changes needed for production

## 🧪 Testing

### Test Local URL

```bash
npm run dev
# Should use http://localhost:3000
```

Create a missionary and check the email activation link.

### Test Production URL

```bash
npm run build
npm start
# Should use https://harvest21.com
```

Or deploy to your hosting platform and test there.

### Test Custom URL

```bash
NEXT_PUBLIC_APP_URL=https://test.com npm run dev
# Should use https://test.com
```

## 📝 Where URLs Are Used

The automatic URL detection is used in these files:

1. **app/admin/missionaries/actions.ts**
   - Generating API URL for sending activation emails

2. **app/api/send-activation-email/route.ts**
   - Generating activation link for email template

3. Any future features that need the base URL

## 🔍 Debugging

### Check Current URL

Add this to any component or API route:

```typescript
import { getBaseUrl } from "@/lib/envHelpers";

console.log("Current base URL:", getBaseUrl());
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL);
```

### Verify in Production

After deploying, create a test missionary and check:
- Server logs for the URL being used
- Email received with correct activation link
- Link should point to `https://harvest21.com/welcome?token=...`

## ⚠️ Important Notes

1. **Environment Variables**: `NEXT_PUBLIC_*` variables are embedded at build time
2. **Rebuilding**: If you change `NEXT_PUBLIC_APP_URL`, rebuild your app
3. **Server Actions**: Can access both client and server environment variables
4. **Default Port**: If your dev server runs on a different port, update the default in `lib/envHelpers.ts`

## 🎓 Learn More

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Runtime vs Build-time Variables](https://nextjs.org/docs/basic-features/environment-variables#loading-environment-variables)

