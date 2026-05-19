import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = "h21-social-v1";

function getRawKey(): Buffer {
  const k = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!k?.trim()) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not set");
  }
  if (/^[0-9a-f]{64}$/i.test(k)) {
    return Buffer.from(k, "hex");
  }
  const b = Buffer.from(k, "base64");
  if (b.length === 32) {
    return b;
  }
  return scryptSync(k, SALT, 32);
}

export function encryptJson(payload: unknown): string {
  const key = getRawKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptJson<T>(blob: string): T {
  const key = getRawKey();
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}
