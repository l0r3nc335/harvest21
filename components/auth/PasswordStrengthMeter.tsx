"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import {
  getPasswordCompositionFailure,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
} from "@/lib/passwordPolicy";

type Props = {
  password: string;
  hints?: string[];
  minLength?: number;
  onValidityChange?: (valid: boolean) => void;
};

type Score = 0 | 1 | 2 | 3 | 4;

const LABEL: Record<Score, string> = {
  0: "Very weak",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

const COLOR: Record<Score, string> = {
  0: "bg-red-500",
  1: "bg-red-500",
  2: "bg-yellow-500",
  3: "bg-green-500",
  4: "bg-green-600",
};

function localScore(password: string, hints: string[]): Score {
  if (!password) return 0;
  let score: Score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score = 1;
  if (!getPasswordCompositionFailure(password)) score = 2;
  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^a-zA-Z0-9]/.test(password));
  if (classes >= 3 && password.length >= PASSWORD_MIN_LENGTH) score = 3;
  if (classes === 4 && password.length >= 16) score = 4;
  const lower = password.toLowerCase();
  for (const h of hints) {
    if (h && h.length >= 3 && lower.includes(h.toLowerCase())) {
      score = Math.max(0, (score - 2) as Score) as Score;
    }
  }
  return score;
}

export function PasswordStrengthMeter({
  password,
  hints = [],
  minLength = PASSWORD_MIN_LENGTH,
  onValidityChange,
}: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverScore, setServerScore] = useState<Score | null>(null);

  const clientScore = useMemo(() => localScore(password, hints), [password, hints]);
  const score: Score = serverScore ?? clientScore;
  const compositionOk =
    password.length >= minLength && getPasswordCompositionFailure(password) === null;
  const clientValid = compositionOk && clientScore >= 3;

  useEffect(() => {
    if (!password || password.length < minLength || !compositionOk) {
      queueMicrotask(() => {
        setServerError(null);
        setServerScore(null);
        onValidityChange?.(false);
      });
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetchWithCsrf("/api/auth/validate-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, hints }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.ok) {
          setServerError(null);
          setServerScore(4);
          onValidityChange?.(true);
        } else {
          setServerError(typeof data?.error === "string" ? data.error : "Password does not meet requirements.");
          setServerScore(typeof data?.score === "number" ? (data.score as Score) : null);
          onValidityChange?.(false);
        }
      } catch {
        if (cancelled) return;
        setServerError(null);
        onValidityChange?.(clientValid);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [password, hints.join("|"), minLength, compositionOk, clientValid, onValidityChange]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!password) return null;

  return (
    <div className="mt-2">
      <p className="text-xs text-zinc-600 mb-2">{PASSWORD_REQUIREMENTS_TEXT}</p>
      <ul className="text-xs text-zinc-600 space-y-0.5 mb-2" aria-label="Password requirements">
        <li className={password.length >= minLength ? "text-green-700" : ""}>
          {password.length >= minLength ? "✓ " : "○ "}At least {minLength} characters
        </li>
        <li className={/[A-Z]/.test(password) ? "text-green-700" : ""}>
          {/[A-Z]/.test(password) ? "✓ " : "○ "}One uppercase letter (A–Z)
        </li>
        <li className={/\d/.test(password) ? "text-green-700" : ""}>
          {/\d/.test(password) ? "✓ " : "○ "}One number (0–9)
        </li>
      </ul>
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i <= score - 1 ? COLOR[score] : "bg-zinc-200"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        Strength: <span className="font-medium">{LABEL[score]}</span>
        {password.length < minLength && (
          <span className="text-zinc-500"> — minimum {minLength} characters</span>
        )}
      </p>
      {serverError && (
        <p className="mt-1 text-xs text-red-600">{serverError}</p>
      )}
    </div>
  );
}
