import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { authEnv } from "@/app/lib/auth/env";

/**
 * At-rest encryption for the dump files written by pg.ts — the enforcement half of the Encryption
 * Standard setting in /admin/security, which until now was stored and never read.
 *
 * A dump carries the entire `auth` schema (accounts, password hashes) and `storage`, so on any
 * filesystem that other people, other backups or a stolen disk can reach, the plaintext archive is
 * the weakest link in the whole system.
 *
 * node:crypto only, no dependency — the module already hashes with createHash for checksums.
 *
 * FILE LAYOUT
 *   magic "RAAOBK1"  7 bytes   identifies an encrypted dump; absent = legacy plaintext dump
 *   algo id          1 byte    1 = aes-128-gcm, 2 = aes-256-gcm
 *   scrypt salt     16 bytes   per-file, so the same passphrase never derives the same key twice
 *   iv              12 bytes   per-file
 *   ciphertext      ...
 *   auth tag        16 bytes   GCM trailer, written last and read from the tail on decrypt
 */

export type BackupCipher = "none" | "aes-128-gcm" | "aes-256-gcm";

const MAGIC = Buffer.from("RAAOBK1", "ascii");
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH;

const ALGO_IDS: Record<Exclude<BackupCipher, "none">, number> = {
  "aes-128-gcm": 1,
  "aes-256-gcm": 2,
};

const KEY_LENGTHS: Record<Exclude<BackupCipher, "none">, number> = {
  "aes-128-gcm": 16,
  "aes-256-gcm": 32,
};

export class BackupDecryptionError extends Error {}

/** Maps the stored `encryption_standard` setting onto the cipher actually used. */
export function cipherFor(standard: "aes128" | "aes256"): Exclude<BackupCipher, "none"> {
  return standard === "aes128" ? "aes-128-gcm" : "aes-256-gcm";
}

/** The cipher a new dump should use: "none" whenever there is no key to encrypt with. */
export function activeCipher(standard: "aes128" | "aes256"): BackupCipher {
  return authEnv.backupEncryptionKey ? cipherFor(standard) : "none";
}

function cipherFromId(id: number): Exclude<BackupCipher, "none"> | null {
  const match = (Object.keys(ALGO_IDS) as Exclude<BackupCipher, "none">[]).find(
    (name) => ALGO_IDS[name] === id
  );
  return match ?? null;
}

function deriveKey(salt: Buffer, cipher: Exclude<BackupCipher, "none">): Buffer {
  if (!authEnv.backupEncryptionKey) {
    throw new BackupDecryptionError("BACKUP_ENCRYPTION_KEY is not set on this server.");
  }
  // scrypt so any passphrase works — no exact-length hex key requirement on the operator.
  return scryptSync(authEnv.backupEncryptionKey, salt, KEY_LENGTHS[cipher]);
}

/** Reads the header of a dump. Returns null for a plaintext (pre-encryption) dump. */
export async function readCipherHeader(
  filePath: string
): Promise<{ cipher: Exclude<BackupCipher, "none">; salt: Buffer; iv: Buffer } | null> {
  const handle = await open(/*turbopackIgnore: true*/ filePath, "r");
  try {
    const header = Buffer.alloc(HEADER_LENGTH);
    const { bytesRead } = await handle.read(header, 0, HEADER_LENGTH, 0);
    if (bytesRead < HEADER_LENGTH) return null;
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) return null;

    const cipher = cipherFromId(header[MAGIC.length]);
    if (!cipher) {
      throw new BackupDecryptionError("Backup was written with an unknown encryption algorithm.");
    }

    const saltStart = MAGIC.length + 1;
    return {
      cipher,
      salt: header.subarray(saltStart, saltStart + SALT_LENGTH),
      iv: header.subarray(saltStart + SALT_LENGTH, saltStart + SALT_LENGTH + IV_LENGTH),
    };
  } finally {
    await handle.close();
  }
}

export async function isEncrypted(filePath: string): Promise<boolean> {
  return (await readCipherHeader(filePath)) !== null;
}

/** Streams `src` into an encrypted `dest`. Never loads the whole dump into memory. */
export async function encryptFile(
  src: string,
  dest: string,
  cipher: Exclude<BackupCipher, "none">
): Promise<void> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt, cipher);

  const cipherStream = createCipheriv(cipher, key, iv);
  const out = createWriteStream(/*turbopackIgnore: true*/ dest);

  out.write(Buffer.concat([MAGIC, Buffer.from([ALGO_IDS[cipher]]), salt, iv]));

  // The GCM tag only exists once the cipher has been flushed, so it is appended after the
  // pipeline finishes rather than being part of the stream — hence `end: false`.
  await pipeline(createReadStream(/*turbopackIgnore: true*/ src), cipherStream, out, { end: false });

  await new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.end(cipherStream.getAuthTag(), () => resolve());
  });
}

/**
 * Streams an encrypted `src` back out to a plaintext `dest`.
 *
 * Throws BackupDecryptionError when the key is missing or wrong — GCM authentication fails at the
 * very end of the stream, so a wrong key is caught rather than producing garbage.
 */
export async function decryptFile(src: string, dest: string): Promise<void> {
  const header = await readCipherHeader(src);
  if (!header) {
    throw new BackupDecryptionError("Backup file is not encrypted.");
  }

  const { size } = await stat(/*turbopackIgnore: true*/ src);
  if (size < HEADER_LENGTH + TAG_LENGTH) {
    throw new BackupDecryptionError("Backup file is truncated.");
  }

  const handle = await open(/*turbopackIgnore: true*/ src, "r");
  let tag: Buffer;
  try {
    tag = Buffer.alloc(TAG_LENGTH);
    await handle.read(tag, 0, TAG_LENGTH, size - TAG_LENGTH);
  } finally {
    await handle.close();
  }

  const decipher = createDecipheriv(header.cipher, deriveKey(header.salt, header.cipher), header.iv);
  decipher.setAuthTag(tag);

  try {
    await pipeline(
      // `end` is inclusive, so this stops on the last ciphertext byte before the tag.
      createReadStream(/*turbopackIgnore: true*/ src, { start: HEADER_LENGTH, end: size - TAG_LENGTH - 1 }),
      decipher,
      createWriteStream(/*turbopackIgnore: true*/ dest)
    );
  } catch (error) {
    // The GCM tag is only checked on final(), so a wrong key surfaces here as an authentication
    // failure rather than as garbage output. Anything else is a genuine I/O error worth seeing.
    const message = error instanceof Error ? error.message : "";
    if (/unable to authenticate|unsupported state/i.test(message)) {
      throw new BackupDecryptionError(
        "Backup could not be decrypted — BACKUP_ENCRYPTION_KEY does not match the key used for this backup."
      );
    }
    throw error;
  }
}
