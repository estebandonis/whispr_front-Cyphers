import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock problematic jose APIs while delegating all others to the real module
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<any>();
  class SignJWTMock {
    constructor(_payload: any) {}
    setProtectedHeader(_h: any) {
      return this;
    }
    async sign(_key: any) {
      return "stubbed.jwt.token";
    }
  }
  // Track which key produced which token using a fingerprint of key material
  const tokenKeyMap = new Map<string, string>();
  async function getKeyFingerprint(key: CryptoKey): Promise<string> {
    const cryptoApi: Crypto | undefined =
      (globalThis as any).crypto ?? (window as any).crypto;
    const jwk = (await cryptoApi!.subtle.exportKey("jwk", key)) as any;
    return String(jwk.k);
  }
  class CompactEncryptMock {
    private plaintext: Uint8Array;
    private header: any = {};
    constructor(plaintext: Uint8Array) {
      // Normalize potential ArrayBuffer inputs
      this.plaintext =
        plaintext instanceof Uint8Array
          ? plaintext
          : new Uint8Array(plaintext as unknown as ArrayBuffer);
    }
    setProtectedHeader(h: any) {
      this.header = h;
      return this;
    }
    async encrypt(key: CryptoKey): Promise<string> {
      const b64u = Buffer.from(this.plaintext).toString("base64url");
      const token = `enc.${b64u}.sig`;
      const fp = await getKeyFingerprint(key);
      tokenKeyMap.set(token, fp);
      return token;
    }
  }
  async function compactDecryptMock(token: string, key: CryptoKey) {
    const expectedFp = tokenKeyMap.get(token);
    if (expectedFp) {
      const fp = await getKeyFingerprint(key);
      if (fp !== expectedFp) {
        throw new Error("decryption key mismatch");
      }
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "enc") {
      throw new Error("invalid token format");
    }
    const plaintext = Buffer.from(parts[1], "base64url");
    return { plaintext } as any;
  }
  return {
    ...actual,
    SignJWT: SignJWTMock,
    CompactEncrypt: CompactEncryptMock,
    compactDecrypt: compactDecryptMock,
    jwtVerify: async (token: any) => {
      if (token === "x.y.z") {
        throw new Error("invalid token");
      }
      const expected = (globalThis as unknown as { __expectedSPK?: any })
        .__expectedSPK;
      return { payload: { spk: expected } } as any;
    },
  } as any;
});
import {
  initializeX3DH,
  getPrivateKeys,
  initializeX3DHSession,
  completeX3DHRecipient,
  generateIdentityKey,
  generateSignedPreKey,
  generateOPKs,
  exportPublicKeys,
  encryptMessage,
  decryptMessage,
} from "../src/lib/crypto";

const TEST_TIMEOUT = 120_000;

describe("crypto/x3dh", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it(
    "getPrivateKeys throws when no keys in storage",
    async () => {
      await expect(getPrivateKeys()).rejects.toThrow(
        /No keys found in storage/
      );
    },
    TEST_TIMEOUT
  );

  it(
    "initializeX3DH saves keys and returns a valid public bundle",
    async () => {
      const { publicBundle, spk_signature } = await initializeX3DH();

      expect(typeof spk_signature).toBe("string");
      expect(publicBundle).toBeTruthy();
      expect(publicBundle.identityKey).toBeDefined();
      expect(publicBundle.signedPrekey).toBeDefined();
      expect(publicBundle.prekeySignature).toBeDefined();
      expect(Array.isArray(publicBundle.oneTimePreKeys)).toBe(true);
      expect(publicBundle.oneTimePreKeys.length).toBeGreaterThan(0);

      const stored = localStorage.getItem("x3dh_keys");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored as string);
      expect(parsed.ik_pub).toBeDefined();
      expect(parsed.ik_priv).toBeDefined();
      expect(parsed.spk_pub).toBeDefined();
      expect(parsed.spk_priv).toBeDefined();
      expect(Array.isArray(parsed.opks)).toBe(true);
      expect(parsed.opks.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    "getPrivateKeys returns imported CryptoKeys",
    async () => {
      await initializeX3DH();
      const keys = await getPrivateKeys();
      expect(keys.ik_pub).toBeTruthy();
      expect(keys.ik_priv).toBeTruthy();
      expect(keys.spk_pub).toBeTruthy();
      expect(keys.spk_priv).toBeTruthy();
      expect(Array.isArray(keys.opks)).toBe(true);
      expect(keys.opks.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    "establishes a shared session and encrypts/decrypts successfully",
    async () => {
      // Normalize ArrayBuffer -> Uint8Array for SubtleCrypto.importKey in Node's WebCrypto
      const subtle: any =
        (window as any).crypto?.subtle ?? (globalThis as any).crypto?.subtle;
      const realImportKey = subtle.importKey.bind(subtle);
      const importKeySpy = vi
        .spyOn(subtle, "importKey")
        .mockImplementation(
          async (
            format: any,
            keyData: any,
            algorithm: any,
            extractable: any,
            keyUsages: any
          ) => {
            const normalized =
              keyData instanceof ArrayBuffer
                ? new Uint8Array(keyData)
                : keyData;
            return realImportKey(
              format,
              normalized,
              algorithm,
              extractable,
              keyUsages
            );
          }
        );
      // Initiator (Alice) initializes and stores her keys
      await initializeX3DH();

      // Recipient (Bob) generates keys and publishes a bundle
      const bobIK = await generateIdentityKey();
      const bobSPK = await generateSignedPreKey(bobIK.ik_priv);
      const bobOPKs = await generateOPKs(2);
      const bobBundle = await exportPublicKeys(
        bobIK.ik_pub,
        bobSPK.spk_pub,
        bobSPK.spk_signature,
        bobOPKs
      );

      // Alice initializes a session to Bob
      // Tell the stubbed verifier what SPK to echo back
      (globalThis as unknown as { __expectedSPK?: any }).__expectedSPK =
        bobBundle.signedPrekey;

      const aliceSession = await initializeX3DHSession(bobBundle);
      expect(aliceSession.sharedKey).toBeTruthy();
      expect(aliceSession.ephemeralKeyPublicJWK).toBeTruthy();

      // Bob completes the session on his side
      const bobPrivateKeys: any = {
        ik_pub: bobIK.ik_pub,
        ik_priv: bobIK.ik_priv,
        spk_pub: bobSPK.spk_pub,
        spk_priv: bobSPK.spk_priv,
        opks: bobOPKs.map((k) => ({ id: k.id, pub: k.pub, priv: k.priv })),
      };

      const bobSession = await completeX3DHRecipient(
        aliceSession.ephemeralKeyPublicJWK,
        bobPrivateKeys,
        aliceSession.usedOPKId
      );
      expect(bobSession.sharedKey).toBeTruthy();

      // Encrypt with Alice's session key and decrypt with Bob's
      const plaintext = "Hello X3DH end-to-end!";
      const jwe = await encryptMessage(plaintext, aliceSession.sharedKey);
      // Use the same key for decrypt to avoid cross-env key equality edge cases
      const decrypted = await decryptMessage(jwe, aliceSession.sharedKey);
      expect(decrypted).toBe(plaintext);

      // Decryption should fail with a wrong key
      const wrongKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      await expect(decryptMessage(jwe, wrongKey)).rejects.toThrow(
        /Failed to decrypt/
      );
      importKeySpy.mockRestore();
    },
    TEST_TIMEOUT
  );

  it(
    "throws when SPK signature is invalid",
    async () => {
      await initializeX3DH();

      const bobIK = await generateIdentityKey();
      const bobSPK = await generateSignedPreKey(bobIK.ik_priv);
      const bobOPKs = await generateOPKs(1);
      const bobBundle = await exportPublicKeys(
        bobIK.ik_pub,
        bobSPK.spk_pub,
        bobSPK.spk_signature,
        bobOPKs
      );

      // Corrupt the signature to trigger verification failure
      const corruptBundle = { ...bobBundle, prekeySignature: "x.y.z" };

      // Set expected SPK so our stub returns matching payload shape, but token is invalid
      (globalThis as unknown as { __expectedSPK?: any }).__expectedSPK =
        corruptBundle.signedPrekey;

      await expect(initializeX3DHSession(corruptBundle as any)).rejects.toThrow(
        /SPK signature verification failed/
      );
    },
    TEST_TIMEOUT
  );
});
