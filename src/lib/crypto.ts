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
import { Buffer } from "buffer";

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
  const prk = await window.crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: { name: hash } },
    false,
    ["sign"]
  );

  const extractedKey = await window.crypto.subtle.sign("HMAC", prk, ikm);

  // Step 2: Expand
  const expandKey = await window.crypto.subtle.importKey(
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

    const blockT = await window.crypto.subtle.sign("HMAC", expandKey, data);

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
  const opks: { pub: CryptoKey; priv: CryptoKey }[] = [];
  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };

  for (let i = 0; i < count; i++) {
    const { publicKey, privateKey } = await generateKeyPair(
      "ECDH-ES",
      keyPairOptions
    );
    opks.push({ pub: publicKey, priv: privateKey });
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
  opks: { pub: CryptoKey; priv: CryptoKey }[]
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
    opks: opks.map((k) => ({ ...k })),
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
  opks: { pub: CryptoKey; priv: CryptoKey }[];
}) {
  try {
    const exportedKeys = {
      ik_pub: await exportJWK(keys.ik_pub),
      ik_priv: await exportJWK(keys.ik_priv),
      spk_pub: await exportJWK(keys.spk_pub),
      spk_priv: await exportJWK(keys.spk_priv),
      opks: await Promise.all(
        keys.opks.map(async (k) => ({
          pub: await exportJWK(k.pub),
          priv: await exportJWK(k.priv),
        }))
      ),
    };

    // Store keys in localStorage only
    localStorage.setItem("x3dh_keys", JSON.stringify(exportedKeys));
    console.log("Keys saved to localStorage successfully");
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
  const recipientSPK = await importJWK(spkJwk, "ECDH-ES");

  // Verify the SPK signature
  try {
    const { payload } = await jwtVerify(
      recipientPublicBundle.prekeySignature,
      recipientIK
    );

    // Confirm the SPK in the signature matches the provided SPK
    const signedSPK = (payload as any).spk;

    // Only compare the essential fields and values, ignoring additional properties
    // or formatting differences that don't affect the cryptographic properties
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

    // Compare the essential fields only
    if (
      signedSPKEssential.x !== providedSPKEssential.x ||
      signedSPKEssential.y !== providedSPKEssential.y ||
      signedSPKEssential.crv !== providedSPKEssential.crv ||
      signedSPKEssential.kty !== providedSPKEssential.kty
    ) {
      throw new Error("SPK signature verification failed: SPK mismatch");
    }

    console.log("SPK signature verified successfully!");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("SPK verification error:", errorMessage);
    throw new Error(`SPK signature verification failed: ${errorMessage}`);
  }

  // Generate ephemeral key with extractable option
  const keyPairOptions: GenerateKeyPairOptions = {
    extractable: true,
  };
  const { publicKey: ek_pub, privateKey: ek_priv } = await generateKeyPair(
    "ECDH-ES",
    keyPairOptions
  );

  // Handle different one-time pre-key formats
  let recipientOPK = null;
  let opkId: string | number | undefined;

  // Check for oneTimePreKeys array (original format)
  if (
    recipientPublicBundle.oneTimePreKeys &&
    recipientPublicBundle.oneTimePreKeys.length > 0
  ) {
    const opkToUse = recipientPublicBundle.oneTimePreKeys[0];
    opkId = opkToUse.id || opkToUse.key?.id;
    const opkKeyData = opkToUse.key || opkToUse;

    const opkJwk = {
      kty: opkKeyData.kty,
      crv: opkKeyData.crv,
      x: opkKeyData.x,
      y: opkKeyData.y,
    };
    recipientOPK = await importJWK(opkJwk, "ECDH-ES");
  }
  // Check for single otpKey (alternative format)
  else if (recipientPublicBundle.otpKey) {
    const opkToUse = recipientPublicBundle.otpKey;
    opkId = opkToUse.id;

    const opkJwk = {
      kty: opkToUse.kty,
      crv: opkToUse.crv,
      x: opkToUse.x,
      y: opkToUse.y,
    };
    recipientOPK = await importJWK(opkJwk, "ECDH-ES");
  }

  // MODIFIED ECDH KEY DERIVATIONS
  console.log("Starting ECDH operations");

  // In standard X3DH:
  // DH1 = DH(IKa, SPKb) - We can't do this if IK is ES256 (signature only)
  // DH2 = DH(EKa, IKb) - We can't do this if IKb is ES256 (signature only)
  // DH3 = DH(EKa, SPKb) - We can do this (EKa and SPKb are ECDH-ES)
  // DH4 = DH(EKa, OPKb) - We can do this (EKa and OPKb are ECDH-ES)

  // For a simplified implementation, we'll use:
  // DH3 = DH(EKa, SPKb)
  // DH4 = DH(EKa, OPKb) - if OPK is available

  // Attempting to import recipient's IK as ECDH for a simulation (if it works)
  let recipientIKforDH = null;
  try {
    // Try to reimport IK as ECDH key (this may not work depending on the curve)
    recipientIKforDH = await importJWK(ikJwk, "ECDH-ES");
    console.log("Successfully imported IK as ECDH key");
  } catch (err) {
    console.log("Could not import IK as ECDH key:", err);
    // Continue without this key
  }

  // Initialize array to collect DH operations that succeed
  const dhResults: ArrayBuffer[] = [];

  // Attempt DH1 (if possible)
  // if (recipientIKforDH) {
  //   try {
  //     // Note: We'll skip this because in most implementations IK is not ECDH-compatible
  //     // const dh1 = await crypto.subtle.deriveBits(
  //     //   { name: "ECDH", public: recipientSPK },
  //     //   myKeys.ik_priv,
  //     //   256
  //     // );
  //     // dhResults.push(dh1);
  //     // console.log("DH1 complete");
  //   } catch (err) {
  //     console.error("DH1 failed:", err);
  //     // Continue without this key
  //   }
  // }

  // Attempt DH2 (if possible)
  // if (recipientIKforDH) {
  //   try {
  //     // Note: We'll skip this because in most implementations IK is not ECDH-compatible
  //     // const dh2 = await crypto.subtle.deriveBits(
  //     //   { name: "ECDH", public: recipientIKforDH },
  //     //   ek_priv,
  //     //   256
  //     // );
  //     // dhResults.push(dh2);
  //     // console.log("DH2 complete");
  //   } catch (err) {
  //     console.error("DH2 failed:", err);
  //     // Continue without this key
  //   }
  // }

  // Always do DH3 - this should work
  try {
    console.log("Starting DH3");
    const dh3 = await crypto.subtle.deriveBits(
      { name: "ECDH", public: recipientSPK },
      ek_priv,
      256
    );
    dhResults.push(dh3);
    console.log("DH3 complete");
  } catch (err) {
    console.error("DH3 failed:", err);
    throw new Error(
      "Critical DH operation failed: " +
        (err instanceof Error ? err.message : String(err))
    );
  }

  // Attempt DH4 (if OPK is available)
  if (recipientOPK) {
    try {
      console.log("Starting DH4");
      const dh4 = await crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientOPK },
        ek_priv,
        256
      );
      dhResults.push(dh4);
      console.log("DH4 complete");
    } catch (err) {
      console.error("DH4 failed:", err);
      // Continue without this key
    }
  }

  // Make sure we have at least one successful DH operation
  if (dhResults.length === 0) {
    throw new Error("Could not complete any Diffie-Hellman operations");
  }

  // Concatenate the DH results
  const preMasterSecret = concatBuffers(...dhResults);
  console.log(
    "Pre-master secret created from",
    dhResults.length,
    "DH operations"
  );

  const info = new TextEncoder().encode("Whispr X3DH Shared Secret v1");
  const salt = new Uint8Array(0);

  try {
    console.log("Starting key derivation with HKDF");
    // Use our own HKDF implementation instead of the external library
    const sharedKeyBytes = await hkdfDerive(
      new Uint8Array(preMasterSecret),
      salt,
      info,
      32 // 32 bytes = 256 bits
    );

    console.log("HKDF key derivation completed successfully");

    const SK = await window.crypto.subtle.importKey(
      "raw",
      sharedKeyBytes,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    console.log("Shared key created successfully");

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
  } catch (err) {
    console.error("Error during key derivation:", err);
    throw new Error(
      "Key derivation failed: " +
        (err instanceof Error ? err.message : String(err))
    );
  }
}

interface StoredOpkType {
  id?: string | number; // Optional custom ID field for OPKs
  pub: any | CryptoKey; // Changed JsonWebKey to any
  priv: any | CryptoKey; // Changed JsonWebKey to any
  // kid is a standard JWK parameter, usually accessed via jwk.kid
}

interface MyPrivateKeysType {
  ik_pub: CryptoKey;
  ik_priv: CryptoKey;
  spk_pub: CryptoKey;
  spk_priv: CryptoKey;
  opks: StoredOpkType[];
}

export async function completeX3DHRecipient(
  initiatorEphemeralKeyJWK: any,
  initiatorIKPubJWK: any,
  myPrivateKeys: MyPrivateKeysType, // Use the defined type
  usedOPKId?: string | number
) {
  const initiatorEKPub = await importJWK(initiatorEphemeralKeyJWK, "ECDH-ES");
  const initiatorIKPub = await importJWK(initiatorIKPubJWK, "ES256");

  const dh1 = await crypto.subtle.deriveBits(
    { name: "ECDH", public: initiatorIKPub },
    myPrivateKeys.spk_priv, // This is CryptoKey from getPrivateKeys
    256
  );

  const dh2 = await crypto.subtle.deriveBits(
    { name: "ECDH", public: initiatorEKPub },
    myPrivateKeys.ik_priv, // This is CryptoKey from getPrivateKeys
    256
  );

  const dh3 = await crypto.subtle.deriveBits(
    { name: "ECDH", public: initiatorEKPub },
    myPrivateKeys.spk_priv, // This is CryptoKey from getPrivateKeys
    256
  );

  let preMasterSecret;
  if (usedOPKId && myPrivateKeys.opks) {
    // Find the OPK based on its ID or standard JWK kid
    const usedOPKEntry = myPrivateKeys.opks.find((opk) => {
      if (opk.id && opk.id.toString() === usedOPKId.toString()) return true;
      const pubJwk = opk.pub as any; // Changed JsonWebKey to any
      if (
        typeof pubJwk === "object" &&
        pubJwk.kid &&
        pubJwk.kid === usedOPKId.toString()
      )
        return true;
      const privJwk = opk.priv as any; // Changed JsonWebKey to any
      if (
        typeof privJwk === "object" &&
        privJwk.kid &&
        privJwk.kid === usedOPKId.toString()
      )
        return true;
      return false;
    });

    if (!usedOPKEntry)
      throw new Error("Used OPK not found for ID: " + usedOPKId);

    let opk_priv_for_dh: CryptoKey;
    if (usedOPKEntry.priv instanceof CryptoKey) {
      opk_priv_for_dh = usedOPKEntry.priv;
    } else if (typeof usedOPKEntry.priv === "object") {
      const privateJwk = usedOPKEntry.priv as any; // Changed JsonWebKey to any
      if (!privateJwk.kty)
        throw new Error("OPK private key is not a valid JWK object.");
      opk_priv_for_dh = await importJWK(privateJwk, "ECDH-ES");
    } else {
      throw new Error("OPK private key is not in a recognizable format.");
    }

    const dh4 = await crypto.subtle.deriveBits(
      { name: "ECDH", public: initiatorEKPub },
      opk_priv_for_dh, // This is now guaranteed to be CryptoKey
      256
    );
    preMasterSecret = concatBuffers(dh1, dh2, dh3, dh4);
  } else {
    preMasterSecret = concatBuffers(dh1, dh2, dh3);
  }

  const info = new TextEncoder().encode("Whispr X3DH Shared Secret v1");
  const salt = new Uint8Array([]);

  const sharedKeyBytes = await hkdfDerive(
    new Uint8Array(preMasterSecret),
    salt,
    info,
    32
  );

  const SK = await crypto.subtle.importKey(
    "raw",
    sharedKeyBytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

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
