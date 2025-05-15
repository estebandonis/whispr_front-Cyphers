import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  importJWK,
  jwtVerify,
  CompactEncrypt,
  compactDecrypt,
  JWK,
  GenerateKeyPairOptions,
} from "jose";

/**
 * X3DH Protocol implementation for secure communication
 * Based on the Signal Protocol specification
 */

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
  ik_priv: CryptoKey,
  spk_pub: CryptoKey,
  spk_priv: CryptoKey,
  spk_signature: string,
  opks: { pub: CryptoKey; priv: CryptoKey }[]
) {
  // Export public and private keys to JWK format
  const ikPublicJwk = await exportJWK(ik_pub);
  const ikPrivateJwk = await exportJWK(ik_priv);
  const spkPublicJwk = await exportJWK(spk_pub);
  const spkPrivateJwk = await exportJWK(spk_priv);

  // Combine public and private components for each key to match the schema
  const identityKey = {
    kty: ikPublicJwk.kty,
    crv: ikPublicJwk.crv,
    x: ikPublicJwk.x,
    y: ikPublicJwk.y,
    d: ikPrivateJwk.d, // Private key component
  };

  const signedPrekey = {
    kty: spkPublicJwk.kty,
    crv: spkPublicJwk.crv,
    x: spkPublicJwk.x,
    y: spkPublicJwk.y,
    d: spkPrivateJwk.d, // Private key component
  };

  // Export one-time pre-keys in the same format
  const oneTimePreKeys = await Promise.all(
    opks.map(async (k) => {
      const pubJwk = await exportJWK(k.pub);
      const privJwk = await exportJWK(k.priv);

      return {
        kty: pubJwk.kty,
        crv: pubJwk.crv,
        x: pubJwk.x,
        y: pubJwk.y,
        d: privJwk.d, // Private key component
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

//
// 5. High-level: On first-time load (new account)
//
export async function initializeX3DH() {
  // Step 1: Identity key
  const { ik_pub, ik_priv } = await generateIdentityKey();

  // Step 2: Signed pre-key
  const { spk_pub, spk_priv, spk_signature } = await generateSignedPreKey(
    ik_priv
  );

  // Step 3: One-time pre-keys
  const opks = await generateOPKs(20);

  // Step 4: Export public data
  const publicBundle = await exportPublicKeys(
    ik_pub,
    ik_priv,
    spk_pub,
    spk_priv,
    spk_signature,
    opks
  );

  // Step 5: Save private keys securely
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
    // d is private key component, not needed for recipient's public key
  };

  const spkJwk = {
    kty: recipientPublicBundle.signedPrekey.kty,
    crv: recipientPublicBundle.signedPrekey.crv,
    x: recipientPublicBundle.signedPrekey.x,
    y: recipientPublicBundle.signedPrekey.y,
    // d is private key component, not needed for recipient's public key
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

    // Compare only the essential parts of the SPK JWK
    const providedSPKEssential = {
      kty: spkJwk.kty,
      crv: spkJwk.crv,
      x: spkJwk.x,
      y: spkJwk.y,
    };

    if (JSON.stringify(signedSPK) !== JSON.stringify(providedSPKEssential)) {
      throw new Error("SPK signature verification failed: SPK mismatch");
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
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

  // Choose a one-time pre-key if available
  let recipientOPK = null;
  if (
    recipientPublicBundle.oneTimePreKeys &&
    recipientPublicBundle.oneTimePreKeys.length > 0
  ) {
    // Get the first one-time pre-key
    const opkJwk = {
      kty: recipientPublicBundle.oneTimePreKeys[0].kty,
      crv: recipientPublicBundle.oneTimePreKeys[0].crv,
      x: recipientPublicBundle.oneTimePreKeys[0].x,
      y: recipientPublicBundle.oneTimePreKeys[0].y,
      // d is private key component, not needed for recipient's public key
    };

    // Import the OPK
    recipientOPK = await importJWK(opkJwk, "ECDH-ES");
  }

  // Compute the shared secrets using ECDH
  // DH1 = DH(IKa, SPKb)
  // DH2 = DH(EKa, IKb)
  // DH3 = DH(EKa, SPKb)
  // DH4 = DH(EKa, OPKb) (optional)

  // This is a simplified version - in a real implementation, you would
  // use the Web Crypto API to derive the shared keys using ECDH

  // Return the session information
  return {
    ephemeralKey: ek_pub,
    // Other necessary session info would be here
  };
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
