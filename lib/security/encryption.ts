import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function getEncryptionKeyMaterial() {
  const rawKey = process.env.ENCRYPTION_KEY
  if (!rawKey) {
    throw new Error("ENCRYPTION_KEY is required for Google refresh token encryption")
  }

  if (/^[A-Fa-f0-9]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex")
  }

  try {
    const decoded = Buffer.from(rawKey, "base64")
    if (decoded.length === 32) {
      return decoded
    }
  } catch {
    // Fall through to the hashed string path.
  }

  return createHash("sha256").update(rawKey).digest()
}

export function isEncryptionConfigured() {
  return Boolean(process.env.ENCRYPTION_KEY)
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH)
  const key = getEncryptionKeyMaterial()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export function decryptSecret(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = payload.split(":")
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Encrypted secret payload is malformed")
  }

  const key = getEncryptionKeyMaterial()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"))
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
