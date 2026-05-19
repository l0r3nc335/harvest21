import { z } from "zod";
import {
  getPasswordCompositionFailure,
  passwordStrengthMessage,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";

// ---------------------------------------------------------------------------
// Shared input validation schemas for API routes.
// Using Zod ensures early rejection of malformed input and prevents
// type confusion, injection, and unexpected field abuse.
// ---------------------------------------------------------------------------

// Reusable primitives
const email = z.string().trim().email().max(254);
const shortString = z.string().trim().min(1).max(200);

export const passwordFieldSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: passwordStrengthMessage({ ok: false, reason: "too_short" }),
  })
  .max(128)
  .superRefine((val, ctx) => {
    const fail = getPasswordCompositionFailure(val);
    if (fail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: passwordStrengthMessage({ ok: false, reason: fail }),
      });
    }
  });

// Auth
export const signinSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const signupSupporterSchema = z.object({
  firstName: shortString,
  lastName: shortString,
  email,
  password: passwordFieldSchema,
  countryOfResidence: shortString,
});

// Email flows
export const sendResetEmailSchema = z.object({
  email,
});

export const sendActivationEmailSchema = z.object({
  email,
  userName: shortString,
  activationToken: z.string().min(10).max(2048),
});

export const activateAccountSchema = z.object({
  token: z.string().min(10).max(2048),
  password: passwordFieldSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordFieldSchema,
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1).max(2048),
});

// Contact
export const contactSchema = z.object({
  name: shortString,
  email,
  message: z.string().trim().min(1).max(5000),
});

// Payment
export const createPaymentIntentSchema = z.object({
  amountCents: z.number().int().min(100).max(100_000_00), // max $100k
  pageId: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().max(500).optional(),
  frequency: z.enum(["one_time", "monthly"]).optional(),
  billing: z.object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    email: z.string().email().max(254).optional(),
  }).optional(),
  designation: z.string().max(50).nullable().optional(),
});

// Page media
export const pageMediaCreateSchema = z.object({
  pageId: z.number().int().positive(),
  mediaUrl: z.string().url().max(2048),
  description: z.string().max(2000).nullable().optional(),
  thumbnailUrl: z.string().url().max(2048).nullable().optional(),
  postToFacebook: z.boolean().optional(),
  postToInstagram: z.boolean().optional(),
});

// Signed upload
export const signedUploadSchema = z.object({
  organizationType: z.enum(["missionary", "agency", "college", "church", "donor"]),
  organizationId: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  folder: z.string().max(50).optional(),
  contentType: z.string().min(3).max(128).optional(),
});

// Page data
export const getPageDataSchema = z.object({
  pageId: z.number().int().positive(),
});

// Query param helpers for GET endpoints
export const paginationParams = z.object({
  pageId: z.string().regex(/^\d+$/).transform(Number),
  page: z.string().default("1").pipe(z.string().regex(/^\d+$/).transform(Number)),
  limit: z.string().default("20").pipe(z.string().regex(/^\d+$/).transform(Number)),
});

/**
 * Parse and validate request body with a Zod schema.
 * Returns { data } on success, { error } on failure.
 * Uses `success` discriminator so callers can narrow with `if (!result.success)`.
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
):
  | { success: true; data: z.infer<T>; error: null }
  | { success: false; data: null; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join(".");
    return {
      success: false,
      data: null,
      error: path ? `${path}: ${firstIssue.message}` : firstIssue.message,
    };
  }
  return { success: true, data: result.data, error: null };
}
