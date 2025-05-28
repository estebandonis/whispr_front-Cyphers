import { v4 as uuidv4 } from "uuid";

export interface ConversationKeys {
  convId: number;
  userId: string;
  symKey: CryptoKey;
  signKeyPair: CryptoKeyPair;
  theirSignPubKey?: JsonWebKey;
  initiator: boolean;
  createdAt: number;
}

const STORAGE_KEY = "whispr_conversations";

/**
 * Save a conversation's cryptographic keys to local storage
 */
export async function saveConversationKeys(
  convId: number,
  userId: string,
  symKey: CryptoKey,
  signKeyPair: CryptoKeyPair,
  theirSignPubKey?: JsonWebKey,
  initiator: boolean = true
): Promise<number> {

  // Export keys for storage
  const exportedSymKey = await window.crypto.subtle.exportKey("jwk", symKey);
  const exportedSignPriv = await window.crypto.subtle.exportKey(
    "jwk",
    signKeyPair.privateKey
  );
  const exportedSignPub = await window.crypto.subtle.exportKey(
    "jwk",
    signKeyPair.publicKey
  );

  // Create conversation entry
  const conversation = {
    convId,
    userId,
    symKey: exportedSymKey,
    signKeyPair: {
      privateKey: exportedSignPriv,
      publicKey: exportedSignPub,
    },
    theirSignPubKey,
    initiator,
    createdAt: Date.now(),
  };

  // Get existing conversations or initialize empty object
  const storedData = localStorage.getItem(STORAGE_KEY);
  const conversations = storedData ? JSON.parse(storedData) : {};

  // Add new conversation
  conversations[convId] = conversation;

  // Store back to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

  return convId;
}

/**
 * Check if we have an existing conversation with a user
 */
export function getConversationWithUser(userId: string): string | null {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return null;

  const conversations = JSON.parse(storedData);

  // Find conversation with this user
  const convEntry = Object.values(conversations).find(
    (conv: any) => conv.userId === userId
  );

  return convEntry ? (convEntry as any).convId : null;
}

/**
 * Load conversation keys from storage and import them as CryptoKey objects
 */
export async function loadConversationKeys(
  convId: string
): Promise<ConversationKeys | null> {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return null;

  const conversations = JSON.parse(storedData);
  const conv = conversations[convId];

  if (!conv) return null;

  // Import keys from storage
  const symKey = await window.crypto.subtle.importKey(
    "jwk",
    conv.symKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const signPrivateKey = await window.crypto.subtle.importKey(
    "jwk",
    conv.signKeyPair.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );

  const signPublicKey = await window.crypto.subtle.importKey(
    "jwk",
    conv.signKeyPair.publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  return {
    convId,
    userId: conv.userId,
    symKey,
    signKeyPair: {
      privateKey: signPrivateKey,
      publicKey: signPublicKey,
    },
    theirSignPubKey: conv.theirSignPubKey,
    initiator: conv.initiator,
    createdAt: conv.createdAt,
  };
}

/**
 * Get conversation by ID without importing the keys
 */
export function getConversationData(convId: string): any | null {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return null;

  const conversations = JSON.parse(storedData);
  return conversations[convId] || null;
}

/**
 * Update an existing conversation with the recipient's signing public key
 */
export function updateConversationWithTheirKey(
  convId: string,
  theirSignPubKey: JsonWebKey
): boolean {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (!storedData) return false;

  const conversations = JSON.parse(storedData);
  if (!conversations[convId]) return false;

  conversations[convId].theirSignPubKey = theirSignPubKey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));

  return true;
}

/**
 * Get all stored conversations
 */
export function getAllConversations(): Record<string, any> {
  const storedData = localStorage.getItem(STORAGE_KEY);
  return storedData ? JSON.parse(storedData) : {};
}
