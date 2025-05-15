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
  spk_pub: CryptoKey,
  spk_signature: string,
  opks: { pub: CryptoKey }[]
) {
  const ikJwk = await exportJWK(ik_pub);
  const spkJwk = await exportJWK(spk_pub);

  // Format keys according to the provided schema
  return {
    identityKey: {
      keyId: crypto.randomUUID(),
      publicKey: btoa(JSON.stringify(ikJwk)),
      signature: "", // Self-signed, usually empty for identity key
    },
    signedPrekey: {
      keyId: crypto.randomUUID(),
      publicKey: btoa(JSON.stringify(spkJwk)),
      signature: btoa(JSON.stringify(spkJwk)), // In a real implementation, this would be a signature
    },
    prekeySignature: spk_signature,
    oneTimeKeys: await Promise.all(
      opks.map(async (k) => {
        const jwk = await exportJWK(k.pub);
        return {
          keyId: crypto.randomUUID(),
          publicKey: btoa(JSON.stringify(jwk)),
        };
      })
    ),
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
    spk_pub,
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
// Secure storage implementation
//
export async function savePrivateKeys(keys: {
  ik_pub: CryptoKey;
  ik_priv: CryptoKey;
  spk_pub: CryptoKey;
  spk_priv: CryptoKey;
  opks: { pub: CryptoKey; priv: CryptoKey }[];
}) {
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

  // Store in IndexedDB for better security than localStorage
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      return await storeKeysIndexedDB(exportedKeys);
    } catch (err) {
      console.error(
        "Failed to save keys to IndexedDB, falling back to localStorage:",
        err
      );
      localStorage.setItem("x3dh_keys", JSON.stringify(exportedKeys));
    }
  } else {
    // Fallback to localStorage with warning
    console.warn(
      "IndexedDB not available, using less secure localStorage for keys"
    );
    localStorage.setItem("x3dh_keys", JSON.stringify(exportedKeys));
  }
}

// Helper for IndexedDB storage
async function storeKeysIndexedDB(keys: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("whisprSecureKeys", 1);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("keys", "readwrite");
      const store = tx.objectStore("keys");

      store.put({
        id: "x3dh_keys",
        data: keys,
        timestamp: Date.now(),
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieve stored private keys from secure storage
 */
export async function getPrivateKeys() {
  // Try IndexedDB first
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      const keys = await getKeysFromIndexedDB();
      if (keys) return keys;
    } catch (err) {
      console.error(
        "Failed to get keys from IndexedDB, checking localStorage:",
        err
      );
    }
  }

  // Fall back to localStorage
  const keysStr = localStorage.getItem("x3dh_keys");
  if (!keysStr) {
    throw new Error("No keys found in storage");
  }

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
}

/**
 * Retrieve stored keys from IndexedDB
 */
async function getKeysFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("whisprSecureKeys", 1);

    request.onsuccess = async () => {
      const db = request.result;
      const tx = db.transaction("keys", "readonly");
      const store = tx.objectStore("keys");

      const getRequest = store.get("x3dh_keys");

      getRequest.onsuccess = async () => {
        if (!getRequest.result) {
          resolve(null);
          return;
        }

        const exportedKeys = getRequest.result.data;

        try {
          const keys = {
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

          resolve(keys);
        } catch (err: unknown) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }

        db.close();
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
        db.close();
      };
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Initialize an X3DH session with another user
 * @param recipientPublicBundle - The recipient's public key bundle
 * @returns Session keys for secure communication
 */
export async function initializeX3DHSession(recipientPublicBundle: any) {
  // Get our private keys
  const myKeys = await getPrivateKeys();

  // Import recipient public keys
  const recipientIK = await importJWK(recipientPublicBundle.ik, "ES256");
  const recipientSPK = await importJWK(recipientPublicBundle.spk, "ECDH-ES");

  // Verify the SPK signature
  try {
    const { payload } = await jwtVerify(
      recipientPublicBundle.spk_sig,
      recipientIK
    );

    // Confirm the SPK in the signature matches the provided SPK
    const signedSPK = (payload as any).spk;
    const providedSPK = recipientPublicBundle.spk;

    if (JSON.stringify(signedSPK) !== JSON.stringify(providedSPK)) {
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
  if (recipientPublicBundle.opks && recipientPublicBundle.opks.length > 0) {
    // For simplicity, just use the first one
    recipientOPK = await importJWK(recipientPublicBundle.opks[0], "ECDH-ES");
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
