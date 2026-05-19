export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_TEXT = `Use at least ${PASSWORD_MIN_LENGTH} characters, including one uppercase letter (A–Z) and one number (0–9).`;

export type PasswordCompositionReason = "missing_uppercase" | "missing_digit";

export type PasswordCheckReason =
  | "too_short"
  | PasswordCompositionReason
  | "low_entropy"
  | "pwned";

export interface PasswordCheckResult {
  ok: boolean;
  reason?: PasswordCheckReason;
  score?: number;
}

export function getPasswordCompositionFailure(
  password: string
): PasswordCompositionReason | null {
  if (!/[A-Z]/.test(password)) return "missing_uppercase";
  if (!/[0-9]/.test(password)) return "missing_digit";
  return null;
}

export function passwordStrengthMessage(
  result: PasswordCheckResult
): string {
  switch (result.reason) {
    case "too_short":
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters. ${PASSWORD_REQUIREMENTS_TEXT}`;
    case "missing_uppercase":
      return "Password must include at least one uppercase letter (A–Z).";
    case "missing_digit":
      return "Password must include at least one number (0–9).";
    case "low_entropy":
      return `${PASSWORD_REQUIREMENTS_TEXT} Also use a less predictable phrase (mix of words or random characters).`;
    case "pwned":
      return "This password has appeared in a public data breach. Please choose a different one.";
    default:
      return result.ok
        ? "Password looks good."
        : `Password does not meet requirements. ${PASSWORD_REQUIREMENTS_TEXT}`;
  }
}
