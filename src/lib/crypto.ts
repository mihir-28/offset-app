export interface EncryptedPayload {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  data: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyCache = new Map<string, CryptoKey>();

function getSalt() {
  return process.env.NEXT_PUBLIC_OFFSET_CRYPTO_SALT || "offset-app-client-crypto-v1";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getUserCryptoKey(userId: string) {
  const cacheKey = `${userId}:${getSalt()}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(cacheKey));
  const key = await crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  keyCache.set(cacheKey, key);
  return key;
}

export async function encryptForUser<T>(userId: string, payload: T): Promise<EncryptedPayload> {
  const key = await getUserCryptoKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = encoder.encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    v: 1,
    alg: "AES-GCM",
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptForUser<T>(userId: string, payload: EncryptedPayload): Promise<T> {
  const key = await getUserCryptoKey(userId);
  const iv = base64ToBytes(payload.iv);
  const encrypted = base64ToBytes(payload.data);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return JSON.parse(decoder.decode(decrypted)) as T;
}

export function hasEncryptedPayload(value: unknown): value is Record<string, unknown> & { encryptedPayload: EncryptedPayload } {
  if (!value || typeof value !== "object") return false;
  const payload = (value as { encryptedPayload?: Partial<EncryptedPayload> }).encryptedPayload;
  return !!payload && payload.v === 1 && payload.alg === "AES-GCM" && !!payload.iv && !!payload.data;
}
