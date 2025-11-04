import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  importJWK,
  jwtVerify,
  CompactEncrypt,
  compactDecrypt,
  GenerateKeyPairOptions,
  // type JsonWebKey, // Import JsonWebKey type - Changed to any for now
} from "jose";
// Remove the hkdf import since we'll implement our own
// import { hkdf } from "@panva/hkdf";

/**
 * X3DH Protocol implementation for secure communication
 * Based on the Signal Protocol specification
 */

// Helper to concatenate ArrayBuffers
function concatBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const result = new Uint8Array(
    buffers.reduce((acc, b) => acc + b.byteLength, 0)
  );
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result.buffer;
}

/**
 * Implementation of HKDF (HMAC-based Key Derivation Function) using Web Crypto API
 * Based on RFC 5869
 */
async function hkdfDerive(
  ikm: Uint8Array, // Input key material
  salt: Uint8Array, // Salt (optional)
  info: Uint8Array, // Context info
  length: number, // Output key length
  hash = "SHA-256" // Hash algorithm
): Promise<ArrayBuffer> {
  // If salt is not provided, use a zero-filled buffer
  if (salt.byteLength === 0) {
    salt = new Uint8Array(hash === "SHA-256" ? 32 : 64);
  }

  // Step 1: Extract
  const prk = await globalThis.crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: { name: hash } },
    false,
    ["sign"]
  );

  const extractedKey = await globalThis.crypto.subtle.sign("HMAC", prk, ikm);

  // Step 2: Expand
  const expandKey = await globalThis.crypto.subtle.importKey(
    "raw",
    extractedKey,
    { name: "HMAC", hash: { name: hash } },
    false,
    ["sign"]
  );

  const n = Math.ceil(length / (hash === "SHA-256" ? 32 : 64));
  const t = new Uint8Array(n * (hash === "SHA-256" ? 32 : 64));

  let T = new Uint8Array();
  for (let i = 0; i < n; i++) {
    // T(i) = HMAC-Hash(PRK, T(i-1) | info | i+1)
    const data = new Uint8Array(T.length + info.length + 1);
    data.set(T, 0);
    data.set(info, T.length);
    data.set(new Uint8Array([i + 1]), T.length + info.length);

    const blockT = await globalThis.crypto.subtle.sign("HMAC", expandKey, data);

    T = new Uint8Array(blockT);
    t.set(T, i * T.length);
  }

  // Return the first 'length' bytes
  return t.slice(0, length).buffer;
}

//
// 1. Generate identity key (IK) — ECDSA (P-256)
//
export async function generateIdentityKey() {
  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };
  const { publicKey, privateKey } = await generateKeyPair(
    "ES256",
    keyPairOptions
  );
  return { ik_pub: publicKey, ik_priv: privateKey };
}

//
// 2. Generate signed pre-key (SPK) — ECDH (P-256)
//
export async function generateSignedPreKey(ik_priv: CryptoKey) {
  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };
  const { publicKey, privateKey } = await generateKeyPair(
    "ECDH-ES",
    keyPairOptions
  );
  const spk_pub_jwk = await exportJWK(publicKey);

  // Sign SPK with identity key (JWT-like, or raw signature if preferred)
  const signedSpk = await new SignJWT({ spk: spk_pub_jwk })
    .setProtectedHeader({ alg: "ES256" })
    .sign(ik_priv);

  return { spk_pub: publicKey, spk_priv: privateKey, spk_signature: signedSpk };
}

//
// 3. Generate OPKs (One-time pre-keys)
//
export async function generateOPKs(count: number) {
  const opks: { id: number; pub: CryptoKey; priv: CryptoKey }[] = [];
  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };

  for (let i = 0; i < count; i++) {
    const { publicKey, privateKey } = await generateKeyPair(
      "ECDH-ES",
      keyPairOptions
    );
    opks.push({ id: i, pub: publicKey, priv: privateKey });
  }
  return opks;
}

//
// 4. Export keys to send to the server
//
export async function exportPublicKeys(
  ik_pub: CryptoKey,
  spk_pub: CryptoKey,
  spk_signature: string,
  opks: { id: number; pub: CryptoKey; priv: CryptoKey }[]
) {
  // Export public keys to JWK format
  const ikPublicJwk = await exportJWK(ik_pub);
  const spkPublicJwk = await exportJWK(spk_pub);

  // Only include public components
  const identityKey = {
    kty: ikPublicJwk.kty,
    crv: ikPublicJwk.crv,
    x: ikPublicJwk.x,
    y: ikPublicJwk.y,
    // Private key component 'd' removed
  };

  const signedPrekey = {
    kty: spkPublicJwk.kty,
    crv: spkPublicJwk.crv,
    x: spkPublicJwk.x,
    y: spkPublicJwk.y,
    // Private key component 'd' removed
  };

  // Export one-time pre-keys (public parts only)
  const oneTimePreKeys = await Promise.all(
    opks.map(async (k) => {
      const pubJwk = await exportJWK(k.pub);

      return {
        id: k.id, // Include the client-assigned ID
        kty: pubJwk.kty,
        crv: pubJwk.crv,
        x: pubJwk.x,
        y: pubJwk.y,
      };
    })
  );

  // Format keys according to the schema
  return {
    identityKey,
    signedPrekey,
    prekeySignature: spk_signature,
    oneTimePreKeys,
  };
}

/**
 * Initialize X3DH (Extended Triple Diffie-Hellman) keys for secure communication.
 *
 * @returns {Object}
 *   - publicBundle: The public key bundle to register with the server
 *   - spk_signature: Signature of the signed pre-key
 */
export async function initializeX3DH(): Promise<{
  publicBundle: any;
  spk_signature: string;
}> {
  const { ik_pub, ik_priv } = await generateIdentityKey();

  const { spk_pub, spk_priv, spk_signature } = await generateSignedPreKey(
    ik_priv
  );

  const opks = await generateOPKs(20);

  const publicBundle = await exportPublicKeys(
    ik_pub,
    spk_pub,
    spk_signature,
    opks
  );

  await savePrivateKeys({
    ik_pub,
    ik_priv,
    spk_pub,
    spk_priv,
    opks: opks, // OPKs already have IDs from generateOPKs
  });

  return {
    publicBundle,
    spk_signature,
  };
}

//
// Secure storage implementation - simplified to use only localStorage
//
export async function savePrivateKeys(keys: {
  ik_pub: CryptoKey;
  ik_priv: CryptoKey;
  spk_pub: CryptoKey;
  spk_priv: CryptoKey;
  opks: { id: number; pub: CryptoKey; priv: CryptoKey }[];
}) {
  try {
    const exportedKeys = {
      ik_pub: await exportJWK(keys.ik_pub),
      ik_priv: await exportJWK(keys.ik_priv),
      spk_pub: await exportJWK(keys.spk_pub),
      spk_priv: await exportJWK(keys.spk_priv),
      opks: await Promise.all(
        keys.opks.map(async (k) => ({
          id: k.id, // Store the client-assigned ID
          pub: await exportJWK(k.pub),
          priv: await exportJWK(k.priv),
        }))
      ),
    };

    // Store keys in localStorage only
    localStorage.setItem("x3dh_keys", JSON.stringify(exportedKeys));
    console.log("🔑 Keys saved successfully");
  } catch (error) {
    console.error("Failed to save keys:", error);
    throw error;
  }
}

/**
 * Retrieve stored private keys from localStorage
 */
export async function getPrivateKeys() {
  // Get keys from localStorage
  const keysStr = localStorage.getItem("x3dh_keys");
  if (!keysStr) {
    throw new Error("No keys found in storage");
  }

  try {
    const exportedKeys = JSON.parse(keysStr);

    return {
      ik_pub: await importJWK(exportedKeys.ik_pub, "ES256"),
      ik_priv: await importJWK(exportedKeys.ik_priv, "ES256"),
      spk_pub: await importJWK(exportedKeys.spk_pub, "ECDH-ES"),
      spk_priv: await importJWK(exportedKeys.spk_priv, "ECDH-ES"),
      opks: await Promise.all(
        exportedKeys.opks.map(async (k: any) => ({
          id: k.id, // Restore the client-assigned ID
          pub: await importJWK(k.pub, "ECDH-ES"),
          priv: await importJWK(k.priv, "ECDH-ES"),
        }))
      ),
    };
  } catch (error) {
    console.error("Error importing keys:", error);
    throw error;
  }
}

/**
 * Verify SPK signature
 */
async function verifySPKSignature(
  recipientIK: CryptoKey,
  spkJwk: any,
  prekeySignature: string
): Promise<void> {
  try {
    const { payload } = await jwtVerify(prekeySignature, recipientIK);
    const signedSPK = (payload as any).spk;

    const providedSPKEssential = {
      kty: spkJwk.kty,
      crv: spkJwk.crv,
      x: spkJwk.x,
      y: spkJwk.y,
    };

    const signedSPKEssential = {
      kty: signedSPK.kty,
      crv: signedSPK.crv,
      x: signedSPK.x,
      y: signedSPK.y,
    };

    if (
      signedSPKEssential.x !== providedSPKEssential.x ||
      signedSPKEssential.y !== providedSPKEssential.y ||
      signedSPKEssential.crv !== providedSPKEssential.crv ||
      signedSPKEssential.kty !== providedSPKEssential.kty
    ) {
      throw new Error("SPK signature verification failed: SPK mismatch");
    }

    console.log("✅ SPK verified");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("SPK verification error:", errorMessage);
    throw new Error(`SPK signature verification failed: ${errorMessage}`);
  }
}

/**
 * Import recipient OPK from bundle
 */
async function importRecipientOPK(
  recipientPublicBundle: any
): Promise<{ opk: CryptoKey | null; opkId: string | number | undefined }> {
  if (
    recipientPublicBundle.oneTimePreKeys &&
    recipientPublicBundle.oneTimePreKeys.length > 0
  ) {
    const opkToUse = recipientPublicBundle.oneTimePreKeys[0];
    const opkId = opkToUse.id;

    const opkJwk = {
      kty: opkToUse.kty,
      crv: opkToUse.crv,
      x: opkToUse.x,
      y: opkToUse.y,
    };
    const recipientOPKImport = await importJWK(opkJwk, "ECDH-ES");
    if (!(recipientOPKImport instanceof CryptoKey)) {
      throw new TypeError("Failed to import recipient OPK as CryptoKey");
    }
    return { opk: recipientOPKImport, opkId };
  }

  if (recipientPublicBundle.otpKey) {
    const opkToUse = recipientPublicBundle.otpKey;
    const opkId = opkToUse.id;

    const opkJwk = {
      kty: opkToUse.kty,
      crv: opkToUse.crv,
      x: opkToUse.x,
      y: opkToUse.y,
    };
    const recipientOPKImport = await importJWK(opkJwk, "ECDH-ES");
    if (!(recipientOPKImport instanceof CryptoKey)) {
      throw new TypeError("Failed to import recipient OPK as CryptoKey");
    }
    return { opk: recipientOPKImport, opkId };
  }

  return { opk: null, opkId: undefined };
}

/**
 * Perform Diffie-Hellman operations
 */
async function performDHOperations(
  recipientSPK: CryptoKey,
  ek_priv: CryptoKey,
  recipientOPK: CryptoKey | null
): Promise<ArrayBuffer[]> {
  const dhResults: ArrayBuffer[] = [];

  try {
    const dh3 = await crypto.subtle.deriveBits(
      { name: "ECDH", public: recipientSPK },
      ek_priv,
      256
    );
    dhResults.push(dh3);
  } catch (err) {
    console.error("❌ DH3 failed:", err);
    throw new Error(
      "Critical DH operation failed: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  if (recipientOPK) {
    try {
      const dh4 = await crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientOPK },
        ek_priv,
        256
      );
      dhResults.push(dh4);
    } catch (err) {
      console.error("❌ DH4 failed:", err);
      // Continue without this key
    }
  }

  if (dhResults.length === 0) {
    throw new Error("Could not complete any Diffie-Hellman operations");
  }

  return dhResults;
}

/**
 * Derive shared key from pre-master secret
 */
async function deriveSharedKey(preMasterSecret: ArrayBuffer): Promise<CryptoKey> {
  const info = new TextEncoder().encode("Whispr X3DH Shared Secret v1");
  const salt = new Uint8Array(0);

  const sharedKeyBytes = await hkdfDerive(
    new Uint8Array(preMasterSecret),
    salt,
    info,
    32 // 32 bytes = 256 bits
  );

  return await globalThis.crypto.subtle.importKey(
    "raw",
    sharedKeyBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Initialize an X3DH session with another user
 * @param recipientPublicBundle - The recipient's public key bundle
 * @returns Session keys for secure communication
 */
export async function initializeX3DHSession(recipientPublicBundle: any) {
  // Get our private keys
  const myKeys = await getPrivateKeys();

  // The identityKey and signedPrekey are directly JWK objects in the schema format
  const ikJwk = {
    kty: recipientPublicBundle.identityKey.kty,
    crv: recipientPublicBundle.identityKey.crv,
    x: recipientPublicBundle.identityKey.x,
    y: recipientPublicBundle.identityKey.y,
  };

  const spkJwk = {
    kty: recipientPublicBundle.signedPrekey.kty,
    crv: recipientPublicBundle.signedPrekey.crv,
    x: recipientPublicBundle.signedPrekey.x,
    y: recipientPublicBundle.signedPrekey.y,
  };

  // Import recipient public keys
  const recipientIK = await importJWK(ikJwk, "ES256");
  const recipientSPKImport = await importJWK(spkJwk, "ECDH-ES");
  if (!(recipientSPKImport instanceof CryptoKey)) {
    throw new TypeError("Failed to import recipient SPK as CryptoKey");
  }
  const recipientSPK = recipientSPKImport;

  // Verify the SPK signature
  await verifySPKSignature(
    recipientIK,
    spkJwk,
    recipientPublicBundle.prekeySignature
  );

  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };
  const { publicKey: ek_pub, privateKey: ek_priv } = await generateKeyPair(
    "ECDH-ES",
    keyPairOptions
  );

  // Import recipient OPK
  const { opk: recipientOPK, opkId } = await importRecipientOPK(
    recipientPublicBundle
  );

  // Perform DH operations
  const dhResults = await performDHOperations(
    recipientSPK,
    ek_priv,
    recipientOPK
  );

  // Concatenate the DH results
  const preMasterSecret = concatBuffers(...dhResults);

  // Derive shared key
  const SK = await deriveSharedKey(preMasterSecret);

  console.log("✅ X3DH session established");

  const ek_pub_jwk = await exportJWK(ek_pub);

  return {
    sharedKey: SK,
    ephemeralKeyPublicJWK: {
      kty: ek_pub_jwk.kty,
      crv: ek_pub_jwk.crv,
      x: ek_pub_jwk.x,
      y: ek_pub_jwk.y,
    },
    usedOPKId: opkId,
    initiatorIKPubJWK: await exportJWK(myKeys.ik_pub).then((jwk) => ({
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    })),
  };
}

interface StoredOpkType {
  id: number; // Client-assigned ID field for OPKs
  pub: unknown | CryptoKey; // Changed JsonWebKey to unknown
  priv: unknown | CryptoKey; // Changed JsonWebKey to unknown
}

interface MyPrivateKeysType {
  ik_pub: CryptoKey;
  ik_priv: CryptoKey;
  spk_pub: CryptoKey;
  spk_priv: CryptoKey;
  opks: StoredOpkType[];
}

/**
 * Import OPK private key for DH operation
 */
async function importOPKPrivateKey(
  usedOPKEntry: StoredOpkType
): Promise<CryptoKey> {
  if (usedOPKEntry.priv instanceof CryptoKey) {
    return usedOPKEntry.priv;
  }

  if (typeof usedOPKEntry.priv === "object" && usedOPKEntry.priv !== null) {
    const privateJwk = usedOPKEntry.priv as any;
    if (!privateJwk.kty) {
      throw new TypeError("OPK private key is not a valid JWK object.");
    }
    const importedKey = await importJWK(privateJwk, "ECDH-ES");
    if (!(importedKey instanceof CryptoKey)) {
      throw new TypeError("Failed to import OPK private key as CryptoKey");
    }
    return importedKey;
  }

  throw new TypeError("OPK private key is not in a recognizable format.");
}

/**
 * Perform recipient DH operations
 */
async function performRecipientDHOperations(
  initiatorEKPub: CryptoKey,
  spk_priv: CryptoKey,
  opk_priv: CryptoKey | null
): Promise<ArrayBuffer[]> {
  const dhResults: ArrayBuffer[] = [];

  try {
    const dh3 = await crypto.subtle.deriveBits(
      { name: "ECDH", public: initiatorEKPub },
      spk_priv,
      256
    );
    dhResults.push(dh3);
  } catch (err) {
    console.error("❌ DH3 failed:", err);
    throw new Error(
      "Critical DH operation failed: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  if (opk_priv) {
    try {
      const dh4 = await crypto.subtle.deriveBits(
        { name: "ECDH", public: initiatorEKPub },
        opk_priv,
        256
      );
      dhResults.push(dh4);
    } catch (err) {
      console.error("❌ DH4 failed:", err);
      // Continue without this key - this is not critical
    }
  }

  if (dhResults.length === 0) {
    throw new Error("Could not complete any Diffie-Hellman operations");
  }

  return dhResults;
}

export async function completeX3DHRecipient(
  initiatorEphemeralKeyJWK: any,
  myPrivateKeys: MyPrivateKeysType,
  usedOPKId?: string | number
) {
  console.log("🔐 Processing X3DH recipient");

  // Import the initiator's ephemeral key for ECDH
  const initiatorEKPubImport = await importJWK(
    initiatorEphemeralKeyJWK,
    "ECDH-ES"
  );
  if (!(initiatorEKPubImport instanceof CryptoKey)) {
    throw new TypeError("Failed to import initiator ephemeral key as CryptoKey");
  }
  const initiatorEKPub = initiatorEKPubImport;

  // Find and import OPK if available
  let opk_priv: CryptoKey | null = null;
  if (usedOPKId && myPrivateKeys.opks) {
    try {
      const usedOPKEntry = myPrivateKeys.opks.find((opk) => {
        return opk.id.toString() === usedOPKId.toString();
      });

      if (!usedOPKEntry) {
        throw new Error("Used OPK not found for ID: " + usedOPKId);
      }

      opk_priv = await importOPKPrivateKey(usedOPKEntry);
    } catch (err) {
      console.error("❌ OPK import failed:", err);
      // Continue without OPK - this is not critical
    }
  }

  // Perform DH operations
  const dhResults = await performRecipientDHOperations(
    initiatorEKPub,
    myPrivateKeys.spk_priv,
    opk_priv
  );

  // Concatenate the DH results
  const preMasterSecret = concatBuffers(...dhResults);

  // Derive shared key
  const SK = await deriveSharedKey(preMasterSecret);

  console.log("✅ X3DH recipient session established");

  return { sharedKey: SK };
}

/**
 * Encrypt a message using an established X3DH session
 */
export async function encryptMessage(message: string, sessionKey: CryptoKey) {
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);

  // In a real implementation, you would use the session key to encrypt
  // the message using an appropriate algorithm like AES-GCM

  // This is a simplified placeholder for demonstration purposes
  const jwe = await new CompactEncrypt(encodedMessage)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(sessionKey);

  return jwe;
}

/**
 * Decrypt a message using an established X3DH session
 */
export async function decryptMessage(
  encryptedMessage: string,
  sessionKey: CryptoKey
) {
  try {
    // Use compactDecrypt to decrypt the JWE format message
    const { plaintext } = await compactDecrypt(encryptedMessage, sessionKey);

    // Convert the decrypted Uint8Array back to a string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    console.error("Error decrypting message:", error);
    throw new Error(
      `Failed to decrypt message: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
