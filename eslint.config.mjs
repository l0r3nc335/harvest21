import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const WEBHOOK_ADMIN_ALLOWLIST = [
  "lib/webhookAdminClient.ts",
  "lib/donationHelpers.ts",
  "lib/donationReceipt.ts",
  "lib/stripeDonationEmails.ts",
  "lib/oneTimeDonationSideEffects.ts",
  "lib/stripeRecurringDonationPersist.ts",
  "app/api/webhooks/stripe/route.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabaseServer",
              importNames: ["getSupabaseAdmin"],
              message:
                "getSupabaseAdmin has been removed. Use getSupabaseServer() (RLS-enforced) or lib/authAdmin helpers for auth admin operations.",
            },
            {
              name: "@/lib/webhookAdminClient",
              message:
                "lib/webhookAdminClient is only allowed inside Stripe webhook files. Use getSupabaseServer() (RLS-enforced) for all other code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: WEBHOOK_ADMIN_ALLOWLIST,
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
