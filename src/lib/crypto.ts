import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * 회원 개인 API 키 저장용 대칭 암호화 (AES-256-GCM).
 * 키는 AUTH_SECRET 에서 파생한다 — AUTH_SECRET 이 바뀌면 기존 저장 키는 복호화되지 않으므로 회원이 다시 등록해야 한다.
 * 저장 형식: "v1.<iv b64>.<tag b64>.<ciphertext b64>"
 */
const ALGO = "aes-256-gcm";

function derivedKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "kcontent-studio-secret-key-2026-orbitron";
  return createHash("sha256").update(`${secret}::kcontent-user-keys`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, derivedKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptSecret(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    const [v, ivB64, tagB64, ctB64] = enc.split(".");
    if (v !== "v1" || !ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv(ALGO, derivedKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // 시크릿 변경·손상 → 미등록으로 취급
  }
}

/** UI 표시용 마스킹: 앞 4자 + 뒤 4자만 노출 */
export function maskSecret(s: string | null | undefined): string {
  if (!s) return "";
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(8)}${s.slice(-4)}`;
}
