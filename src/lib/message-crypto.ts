/**
 * Utilities for message encryption, decryption, signing and verification
 */

/**
 * Encrypt a message using AES-GCM
 */
export async function encryptMessage(
  message: string,
  encryptionKey: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  // Generate a random IV (Initialization Vector)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Encode the message
  const encodedMessage = new TextEncoder().encode(message);

  // Encrypt the message
  const encryptedData = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encodedMessage
  );

  return {
    ciphertext: new Uint8Array(encryptedData),
    iv,
  };
}

/**
 * Decrypt a message using AES-GCM
 */
export async function decryptMessage(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  encryptionKey: CryptoKey
): Promise<string> {
  // Decrypt the message
  const decryptedData = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    ciphertext
  );

  // Decode the decrypted data
  const decodedMessage = new TextDecoder().decode(decryptedData);

  return decodedMessage;
}

/**
 * Sign a message using ECDSA
 */
export async function signMessage(
  message: string,
  signingKey: CryptoKey
): Promise<Uint8Array> {
  // Encode the message
  const encodedMessage = new TextEncoder().encode(message);

  // Sign the message
  const signature = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    encodedMessage
  );

  return new Uint8Array(signature);
}

/**
 * Verify a message signature using ECDSA
 */
export async function verifySignature(
  message: string,
  signature: Uint8Array,
  verificationKey: CryptoKey
): Promise<boolean> {
  // Encode the message
  const encodedMessage = new TextEncoder().encode(message);

  // Verify the signature
  const isValid = await globalThis.crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    verificationKey,
    signature,
    encodedMessage
  );

  return isValid;
}

/**
 * Format for full encrypted and signed message
 */
export interface SecureMessage {
  ciphertext: number[]; // Array format for easy JSON serialization
  iv: number[]; // Array format for easy JSON serialization
  signature: number[]; // Array format for easy JSON serialization
  senderId: string;
  timestamp: number;
}

/**
 * Prepare a complete secure message (encrypted and signed)
 */
export async function prepareSecureMessage(
  message: string,
  encryptionKey: CryptoKey,
  signingKey: CryptoKey,
  senderId: string
): Promise<SecureMessage> {
  // Encrypt the message
  const { ciphertext, iv } = await encryptMessage(message, encryptionKey);

  // Sign the encrypted message (for authenticity)
  const signature = await signMessage(
    new TextDecoder().decode(ciphertext),
    signingKey
  );

  // Format for transmission
  return {
    ciphertext: Array.from(ciphertext),
    iv: Array.from(iv),
    signature: Array.from(signature),
    senderId,
    timestamp: Date.now(),
  };
}

/**
 * Process and verify a received secure message
 */
export async function processSecureMessage(
  secureMessage: SecureMessage,
  decryptionKey: CryptoKey,
  verificationKey: CryptoKey
): Promise<{ message: string; isAuthentic: boolean }> {
  // Convert arrays back to Uint8Arrays
  const ciphertext = new Uint8Array(secureMessage.ciphertext);
  const iv = new Uint8Array(secureMessage.iv);
  const signature = new Uint8Array(secureMessage.signature);

  // Decrypt the message
  const decryptedMessage = await decryptMessage(ciphertext, iv, decryptionKey);

  // Verify the signature
  const isAuthentic = await verifySignature(
    new TextDecoder().decode(ciphertext),
    signature,
    verificationKey
  );

  return {
    message: decryptedMessage,
    isAuthentic,
  };
}
