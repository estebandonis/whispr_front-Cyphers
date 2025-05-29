import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initializeX3DHSession,
  completeX3DHRecipient,
  getPrivateKeys,
} from "@/lib/crypto";
import {
  getConversationWithUser,
  loadConversationKeys,
  saveConversationKeys,
  updateConversationWithTheirKey,
} from "@/lib/conversation-store";
import {
  decryptMessage,
  prepareSecureMessage,
  processSecureMessage,
} from "@/lib/message-crypto";
import { getCurrentUserId } from "@/lib/utils";
import api from "@/lib/api";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useCurrentUser } from "@/features/user/queries";
import { hc } from "hono/client";
import {
  useGetUserKeyBundle,
  useInitiateConversation,
  useSendMessage,
  useGetPendingConversations,
  useAcceptConversation,
} from "./queries";

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isMine: boolean;
  isAuthentic?: boolean;
}

// Add this interface for pending conversations
interface PendingConversation {
  id: number;
  initiatorId: string | number;
  initialPayload: {
    iv: number[];
    ciphertext: number[];
    ephemeralKeyPublicJWK: any;
    usedOPKId?: string | number;
  };
  initiatorIdentityKey?: any;
}

export default function Chat() {
  const { id: userId } = useParams<{ id: string }>();
  const { data: currentUser } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isSessionEstablished, setIsSessionEstablished] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isInitializingConversation, setIsInitializingConversation] =
    useState(false);
  const [messageToSend, setMessageToSend] = useState();

  // Refs to store cryptographic keys
  const conversationKeysRef = useRef<{
    convId: number;
    symKey: CryptoKey;
    signKeyPair: CryptoKeyPair;
    theirSignPubKey?: JsonWebKey;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // React Query hooks
  const { data: keyBundle, isLoading: isLoadingKeyBundle } =
    useGetUserKeyBundle(userId || "", {
      enabled: !!userId && !conversationId && !isInitializingConversation,
    });
  const { mutateAsync: initiateConversation } = useInitiateConversation();
  // const { mutateAsync: sendMessage } = useSendMessage();

  // Add hooks for pending conversations
  const { data: pendingConversations, isLoading: isLoadingPending } =
    useGetPendingConversations({
      enabled: !conversationId && !isInitializingConversation,
    });
  const { mutateAsync: acceptConversation } = useAcceptConversation();

  // Check for existing conversation or start a new one
  useEffect(() => {
    if (!userId) return;

    const checkExistingConversation = async () => {
      try {
        // Check if we have an existing conversation with this user
        const existingConvId = getConversationWithUser(userId);

        if (existingConvId) {
          console.log(`Found existing conversation: ${existingConvId}`);
          // Load conversation keys
          const keys = await loadConversationKeys(existingConvId);

          if (keys) {
            // Store keys in ref for later use
            conversationKeysRef.current = {
              convId: keys.convId,
              symKey: keys.symKey,
              signKeyPair: keys.signKeyPair,
              theirSignPubKey: keys.theirSignPubKey,
            };

            setConversationId(existingConvId);
            setIsSessionEstablished(true);
            console.log("Conversation keys loaded successfully");
          } else {
            console.error("Failed to load conversation keys");
          }
        }
        // Check if we're the recipient of a pending conversation with this user
        else if (pendingConversations?.length) {
          // Find a pending conversation with this user
          const pendingConvo = pendingConversations.find(
            (convo: PendingConversation) =>
              convo.initiatorId.toString() === userId
          );

          if (pendingConvo) {
            console.log(
              "Found pending conversation as recipient, processing..."
            );
            await processPendingConversation(pendingConvo);
          }
          // If no pending conversation with this specific user, but we have keyBundle, initiate new
          else if (keyBundle && !isInitializingConversation) {
            console.log("No existing conversation, initializing new one");
            await initializeNewConversation();
          }
        }
        // If no pending conversations at all, but we have keyBundle, initiate new
        else if (keyBundle && !isInitializingConversation) {
          console.log("No existing conversation, initializing new one");
          await initializeNewConversation();
        }
      } catch (error) {
        console.error("Error checking/initializing conversation:", error);
      }
    };

    checkExistingConversation();
  }, [userId, keyBundle, pendingConversations]);

  useEffect(() => {
    if (isSessionEstablished && conversationId) {
      console.log("Connecting to WebSocket...");
      const wsUrl = `ws://localhost:3000/message/ws/${conversationId}`;
      const ws = new WebSocket(wsUrl);

      // Store WebSocket reference
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        console.log("WebSocket connection opened");
      });

      ws.addEventListener("message", (event) => {
        console.log("Received message: ", event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" && data.encryptedContent) {
            // Process the received encrypted message
            processReceivedMessage(data.encryptedContent);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      ws.addEventListener("close", () => {
        console.log("WebSocket connection closed");
        wsRef.current = null;
      });

      ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
      });

      // Cleanup on unmount or dependency change
      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }
  }, [isSessionEstablished, conversationId]);

  // no pending -> generas llaves -> encriptas con x3dh (con bundle del otro) -> creas conversaciones con payload encriptado
  // si pending -> agarras payload encriptado -> agarras bundle del otro, derivas con 3xdh -> desencriptas -> guardas llaves descriptadas -> marcas como finalizada

  // Process a pending conversation as the recipient
  const processPendingConversation = async (
    pendingConvo: PendingConversation
  ) => {
    try {
      setIsInitializingConversation(true);
      console.log("Processing pending conversation:", pendingConvo);

      // 1. Get our private keys
      const myKeys = await getPrivateKeys();

      // 2. Extract data from the pending conversation
      const { ephemeralKeyPublicJWK, iv, ciphertext, usedOPKId } =
        pendingConvo.initialPayload;

      // 3. Derive the shared secret using X3DH (recipient side)
      console.log("usedOPKId:", usedOPKId);
      console.log("ephemeralKeyPublicJWK:", ephemeralKeyPublicJWK);
      console.log("initiatorIdentityKey:", pendingConvo.initiatorIdentityKey);

      const { sharedKey } = await completeX3DHRecipient(
        ephemeralKeyPublicJWK,
        pendingConvo.initiatorIdentityKey || {}, // Provide a default empty object if not available
        myKeys as any, // Use type assertion to avoid complex type issues
        usedOPKId
      );

      // 4. Decrypt the initial payload
      const ivArray = new Uint8Array(iv);
      const ciphertextArray = new Uint8Array(ciphertext);

      console.log("Attempting to decrypt with shared key:", sharedKey);
      console.log(
        "IV length:",
        ivArray.length,
        "Ciphertext length:",
        ciphertextArray.length
      );
      console.log("IV bytes:", Array.from(ivArray));
      console.log(
        "First 16 bytes of ciphertext:",
        Array.from(ciphertextArray.slice(0, 16))
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivArray },
        sharedKey,
        ciphertextArray
      );

      // 5. Parse the decrypted message
      const keyMessage = JSON.parse(new TextDecoder().decode(decrypted));
      console.log("Decrypted keyMessage:", keyMessage);
      const { convSignPub, convSignPriv, convSymKey, initiatorId } = keyMessage;

      // 6. Generate our own signing key pair for this conversation
      const mySignKeyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      // 7. Import the symmetric key from the initiator
      console.log("convSymKey type:", typeof convSymKey);
      console.log("convSymKey:", convSymKey);

      // Handle both array and object formats
      let symKeyArray;
      if (Array.isArray(convSymKey)) {
        symKeyArray = convSymKey;
      } else if (typeof convSymKey === "object" && convSymKey !== null) {
        // Convert object with numeric keys back to array
        symKeyArray = Object.values(convSymKey);
      } else {
        throw new Error("Invalid convSymKey format: " + typeof convSymKey);
      }

      console.log("symKeyArray length:", symKeyArray.length);
      console.log("symKeyArray first 8 bytes:", symKeyArray.slice(0, 8));

      const symKeyBytes = new Uint8Array(symKeyArray);
      console.log("symKeyBytes length:", symKeyBytes.length);

      const importedSymKey = await window.crypto.subtle.importKey(
        "raw",
        symKeyBytes,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const importedSignPubKey = await window.crypto.subtle.importKey(
        "jwk",
        convSignPub,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"] // Public key can only be used for verification
      );

      const importedSignPrivKey = await window.crypto.subtle.importKey(
        "jwk",
        convSignPriv,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"] // Public key can only be used for verification
      );

      // 8. Export our public signing key to send back
      const mySignPubKey = await window.crypto.subtle.exportKey(
        "jwk",
        mySignKeyPair.publicKey
      );

      // 9. Accept the conversation and send back our signing key
      await acceptConversation({
        conversationId: pendingConvo.id,
        signingPublicKey: mySignPubKey,
      });

      // 10. Save the conversation keys locally
      const convId = await saveConversationKeys(
        pendingConvo.id,
        pendingConvo.initiatorId.toString(),
        importedSymKey,
        {
          privateKey: importedSignPrivKey,
          publicKey: importedSignPubKey,
        },
        pendingConvo.initiatorIdentityKey, // Store initiator's signing key
        false // We're not the initiator
      );

      // 11. Update local state
      conversationKeysRef.current = {
        convId: pendingConvo.id,
        symKey: importedSymKey,
        signKeyPair: {
          privateKey: importedSignPrivKey,
          publicKey: importedSignPubKey,
        },
        theirSignPubKey: convSignPub,
      };

      setConversationId(pendingConvo.id.toString());
      setIsSessionEstablished(true);
      console.log("Processed pending conversation successfully");
    } catch (error) {
      console.error("Failed to process pending conversation:", error);
    } finally {
      setIsInitializingConversation(false);
    }
  };

  // Initialize a new conversation using X3DH
  const initializeNewConversation = async () => {
    if (!userId || !keyBundle || isInitializingConversation) return;

    try {
      setIsInitializingConversation(true);
      console.log("Initializing new conversation with user:", userId);
      console.log("Recipient's key bundle:", keyBundle);

      // Step 1: Run X3DH to establish a shared secret
      console.log("Key bundle for X3DH:", keyBundle);
      const { sharedKey, ephemeralKeyPublicJWK, usedOPKId, initiatorIKPubJWK } =
        await initializeX3DHSession(keyBundle);

      // Step 2: Generate conversation-specific keys
      // - Symmetric key for message encryption
      const convSymKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      // - Asymmetric key pair for message signing
      const convSignKeyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      // Step 3: Export the public signing key to send to the recipient
      const exportedSignPub = await window.crypto.subtle.exportKey(
        "jwk",
        convSignKeyPair.publicKey
      );

      const exportedSignPriv = await window.crypto.subtle.exportKey(
        "jwk",
        convSignKeyPair.privateKey
      );

      const exportedSymKey = await window.crypto.subtle.exportKey(
        "raw",
        convSymKey
      );

      // Step 4: Prepare initial key message
      const symKeyArray = Array.from(new Uint8Array(exportedSymKey));
      console.log(
        "Exporting symKey as array, length:",
        symKeyArray.length,
        "first 8 bytes:",
        symKeyArray.slice(0, 8)
      );

      const keyMessage = {
        convSignPub: exportedSignPub,
        convSignPriv: exportedSignPriv,
        convSymKey: symKeyArray, // Convert ArrayBuffer to array for JSON
        initiatorId: currentUser?.id?.toString() || "", // Use current user ID
      };

      // Step 5: Encrypt the key message with the shared secret from X3DH
      const encoded = new TextEncoder().encode(JSON.stringify(keyMessage));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        encoded
      );

      // Step 6: Send the encrypted key message to the recipient
      console.log("Sending conversation initiation with usedOPKId:", usedOPKId);
      const initiationResponse = await initiateConversation({
        recipientId: userId,
        payload: {
          iv: Array.from(iv),
          ciphertext: Array.from(new Uint8Array(encrypted)),
          ephemeralKeyPublicJWK,
          usedOPKId,
          initiatorId: currentUser?.id?.toString() || "", // Use current user ID
        },
      });

      console.log("Conversation initiation response:", initiationResponse);

      // Step 7: Save the conversation keys locally
      const convId = await saveConversationKeys(
        Number(initiationResponse.conversationId),
        userId,
        convSymKey,
        convSignKeyPair,
        exportedSignPub,
        true
      );

      // Store keys in ref for later use
      conversationKeysRef.current = {
        convId: Number(initiationResponse),
        symKey: convSymKey,
        signKeyPair: convSignKeyPair,
        theirSignPubKey: exportedSignPub,
      };

      setConversationId(initiationResponse);
      setIsSessionEstablished(true);
      console.log("New conversation initialized successfully with ID:", convId);
    } catch (error) {
      console.error("Failed to initialize new conversation:", error);
    } finally {
      setIsInitializingConversation(false);
    }
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || !conversationKeysRef.current || !userId) return;

    try {
      const { symKey, signKeyPair } = conversationKeysRef.current;

      // Prepare a secure message (encrypted and signed)
      const secureMessage = await prepareSecureMessage(
        message,
        symKey,
        signKeyPair.privateKey,
        currentUser?.id?.toString() || "" // Use current user ID
      );

      // Send through WebSocket if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const messagePayload = {
          type: "message",
          room: conversationId,
          encryptedContent: JSON.stringify(secureMessage),
          senderId: currentUser?.id?.toString() || "",
          timestamp: Date.now(),
        };

        wsRef.current.send(JSON.stringify(messagePayload));
        console.log("Message sent through WebSocket");
      } else {
        console.error("WebSocket not connected, cannot send message");
        // Optionally fall back to HTTP API
        // await sendMessage({...});
        return;
      }

      // Send the message to the server
      // await sendMessage({
      //   conversationId: conversationKeysRef.current.convId,
      //   message: message, // Plain text for local storage only
      //   encryptedContent: JSON.stringify(secureMessage),
      //   senderId: currentUser?.id?.toString() || "", // Use current user ID
      // });

      // Add the message to the local chat
      const newMessage: Message = {
        id: Date.now(),
        sender: currentUser?.name || "You",
        text: message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMine: true,
      };

      setChatMessages((prev) => [...prev, newMessage]);
      setMessage("");

      return secureMessage;
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Helper to process received messages
  const processReceivedMessage = async (encryptedContent: string) => {
    if (
      !conversationKeysRef.current ||
      !conversationKeysRef.current.theirSignPubKey
    ) {
      console.error(
        "Cannot process message: Missing conversation keys or recipient's signing key"
      );
      return;
    }

    try {
      const { symKey } = conversationKeysRef.current;

      // Parse the encrypted content
      const secureMessage = JSON.parse(encryptedContent);

      // Import the recipient's public signing key if it's in JWK format
      let verificationKey: CryptoKey;
      if (typeof conversationKeysRef.current.theirSignPubKey === "object") {
        verificationKey = await window.crypto.subtle.importKey(
          "jwk",
          conversationKeysRef.current.theirSignPubKey,
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["verify"]
        );
      } else {
        verificationKey = conversationKeysRef.current
          .theirSignPubKey as unknown as CryptoKey;
      }

      // Process and verify the secure message
      const { message: decryptedText, isAuthentic } =
        await processSecureMessage(secureMessage, symKey, verificationKey);

      // Add the decrypted message to the chat
      const newMessage: Message = {
        id: secureMessage.timestamp || Date.now(),
        sender: secureMessage.senderId,
        text: decryptedText,
        time: new Date(
          secureMessage.timestamp || Date.now()
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMine: false,
        isAuthentic,
      };

      setChatMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("Error processing received message:", error);
    }
  };

  // Loading state
  if (!userId) {
    return <div className="p-4">No conversation selected</div>;
  }

  if (isLoadingKeyBundle || isLoadingPending || isInitializingConversation) {
    return <div className="p-4">Setting up secure conversation...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 border-b border-neutral-800">
        <h1 className="text-xl font-heading tracking-tighter font-medium uppercase text-neutral-300">
          Chat with User {userId}
        </h1>
        <p className="text-xs text-neutral-500">
          {isSessionEstablished
            ? "Secure session established"
            : "Setting up secure session..."}
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex relative ${
              msg.isMine ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] border-dashed leading-loose px-3 py-2 rounded-md ${
                msg.isMine
                  ? "bg-neutral-900 border border-neutral-800 text-neutral-200"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-300"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-neutral-500">
                  {msg.isAuthentic !== undefined && (
                    <span
                      className={
                        msg.isAuthentic ? "text-green-500" : "text-red-500"
                      }
                    >
                      {msg.isAuthentic ? "✓ Verified" : "⚠ Unverified"}
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-500">{msg.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend}>
        <div className="flex gap-0 w-full h-[73px] mx-auto">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message..."
            className="bg-neutral-900 border-neutral-800 border-l-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-neutral-800 h-full"
            disabled={!isSessionEstablished}
          />
          <Button
            type="submit"
            className="px-8 border-l-0 border-neutral-800! h-full"
            variant="outline"
            disabled={!isSessionEstablished}
          >
            →
          </Button>
        </div>
      </form>
    </div>
  );
}
