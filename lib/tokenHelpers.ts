import "server-only";
import { adminGenerateRecoveryLink } from "@/lib/authAdmin";

export interface ActivationTokenPayload {
  userId: string;
  email: string;
  type: "activation";
  exp?: number;
}

/**
 * Issues an activation token (a Supabase hashed recovery token).
 *
 * Callers receive a token_hash string that the client submits to
 * `/api/activate-account`. That route verifies the token via
 * `supabase.auth.verifyOtp({ type: 'recovery' })` and, on success,
 * updates the password using the resulting user session — so the
 * activation flow no longer relies on service-role calls at runtime.
 *
 * The `userId` and `expiresInHours` parameters are retained for API
 * compatibility. Expiration is governed by Supabase's OTP lifetime.
 */
export async function generateActivationToken(
  userId: string,
  email: string,
  expiresInHours: number = 72
): Promise<string> {
  void userId;
  void expiresInHours;

  const { hashedToken, error } = await adminGenerateRecoveryLink(email);
  if (error || !hashedToken) {
    throw new Error(error?.message || "Failed to generate activation token");
  }
  return hashedToken;
}

/**
 * @deprecated Activation is now handled by Supabase OTP verification in
 * `/api/activate-account`. This helper is no longer used by that route
 * and should be removed once all callers migrate.
 */
export async function verifyActivationToken(
  _token: string
): Promise<ActivationTokenPayload | null> {
  return null;
}
