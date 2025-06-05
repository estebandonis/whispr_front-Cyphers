import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initializeX3DHSession,
  completeX3DHRecipient,
  getPrivateKeys,
} from "@/lib/crypto";
import {
  getConversationWithUser,
  getConversationWithConvId,
  loadConversationKeys,
  saveConversationKeys,
} from "@/lib/conversation-store";
import {
  prepareSecureMessage,
  processSecureMessage,
} from "@/lib/message-crypto";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useCurrentUser } from "@/features/user/queries";
import {
  useGetUserKeyBundle,
  useInitiateConversation,
  useGetPendingConversations,
  useAcceptConversation,
  useGetConversationMessages,
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
  type: "DIRECT" | "GROUP";
}

export default function Chat() {
  const { id: userId, group } = useParams<{ id: string; group?: string }>();
  const { data: currentUser } = useCurrentUser();
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isSessionEstablished, setIsSessionEstablished] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isInitializingConversation, setIsInitializingConversation] =
    useState(false);

  // Refs to store cryptographic keys
  const conversationKeysRef = useRef<{
    convId: number;
    symKey: CryptoKey;
    signKeyPair: CryptoKeyPair;
    theirSignPubKey?: JsonWebKey;
    type: "GROUP" | "DIRECT";
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // React Query hooks
  const { data: keyBundle, isLoading: isLoadingKeyBundle } =
    useGetUserKeyBundle(userId || "", {
      enabled:
        !!userId &&
        !conversationId &&
        !isInitializingConversation &&
        group !== "true",
    });

  const { mutateAsync: initiateConversation } = useInitiateConversation();
  // const { mutateAsync: sendMessage } = useSendMessage();

  // Add hooks for pending conversations
  const { data: pendingConversations, isLoading: isLoadingPending } =
    useGetPendingConversations(userId, {
      enabled: !conversationId && !isInitializingConversation,
    });
  const { mutateAsync: acceptConversation } = useAcceptConversation();

  const { data: messages, refetch: refetchMessages } =
    useGetConversationMessages(userId!, group !== "true");

  useEffect(() => {
    setConversationId(null); // Reset conversationId when switching chats
    setIsSessionEstablished(false); // Optionally reset session state
    setChatMessages([]); // Clear messages
  }, [userId, group]);

  useEffect(() => {
    const processMessages = async () => {
      try {
        await refetchMessages();

        if (messages && conversationKeysRef.current) {
          const { symKey, signKeyPair } = conversationKeysRef.current;

          // Import the recipient's public signing key if it's in JWK format
          const verificationKey: CryptoKey = signKeyPair.publicKey;

          const processedMessages: Message[] = [];

          for (const msg of messages) {
            const content = await JSON.parse(msg.content);
            const { message: decryptedText, isAuthentic } =
              await processSecureMessage(content, symKey, verificationKey);

            const newMessage: Message = {
              id: msg.createdAt || Date.now(),
              sender: msg.senderName || msg.senderId.toString(),
              text: decryptedText,
              time: new Date(msg.createAt || Date.now()).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              ),
              isMine: +msg.senderId === currentUser?.id ? true : false,
              isAuthentic:
                +msg.senderId === currentUser?.id ? undefined : isAuthentic,
            };

            processedMessages.push(newMessage);
          }

          setChatMessages(processedMessages);
        }
      } catch (error) {
        console.error("Error processing messages:", error);
        return;
      }
    };

    processMessages();
  }, [messages, currentUser?.id, userId, refetchMessages]);

  // Check for existing conversation or start a new one
  useEffect(() => {
    if (!userId) return;
    setChatMessages([]); // Clear messages when userId changes

    const checkExistingConversation = async () => {
      try {
        // Check if we have an existing conversation with this user
        let existingConvId = null;
        if (group === "false") {
          existingConvId = getConversationWithUser(userId);
        } else {
          existingConvId = getConversationWithConvId(+userId);
        }

        if (existingConvId) {
          console.log(`🔄 Found existing conversation: ${existingConvId}`);
          // Load conversation keys
          const keys = await loadConversationKeys(existingConvId);

          if (keys) {
            // Store keys in ref for later use
            conversationKeysRef.current = {
              convId: keys.convId,
              symKey: keys.symKey,
              signKeyPair: keys.signKeyPair,
              theirSignPubKey: keys.theirSignPubKey,
              type: keys.type || "DIRECT", // Default to DIRECT if type is not set
            };

            setConversationId(existingConvId);
            setIsSessionEstablished(true);
            console.log("🔑 Keys loaded successfully");
          } else {
            console.error("❌ Failed to load conversation keys");
          }
        }
        // Check if we're the recipient of a pending conversation with this user
        else if (pendingConversations && pendingConversations.length > 0) {
          console.log(
            `⏳ ${pendingConversations.length} pending conversations found`
          );
          // Find a pending conversation with this user
          const pendingConvo = pendingConversations.find(
            (convo: PendingConversation) =>
              (group === "false" &&
                (convo.initiatorId.toString() === userId ||
                  convo.initiatorId.toString() ===
                    currentUser?.id?.toString())) ||
              (group === "true" && convo.id.toString() === userId)
          );

          if (pendingConvo) {
            console.log("🔓 Processing pending conversation");
            await processPendingConversation(pendingConvo);
          }
          // If no pending conversation with this specific user, but we have keyBundle, initiate new
          else if (keyBundle && !isInitializingConversation) {
            console.log("🆕 Initializing new conversation");
            await initializeNewConversation();
          }
        }
        // If no pending conversations at all, but we have keyBundle, initiate new
        else if (keyBundle && !isInitializingConversation) {
          console.log("🆕 Initializing new conversation");
          await initializeNewConversation();
        }
      } catch (error) {
        console.error("Error checking/initializing conversation:", error);
      }
    };

    checkExistingConversation();
  }, [userId, group, keyBundle, pendingConversations]);

  useEffect(() => {
    if (isSessionEstablished && conversationId) {
      console.log("🔌 Connecting to WebSocket...");
      const serverUrl =
        import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
      const isSecure = serverUrl.startsWith("https://");
      const wsProtocol = isSecure ? "wss://" : "ws://";
      const wsBaseUrl = serverUrl.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}${wsBaseUrl}/message/ws/${conversationId}`;

      let retryCount = 0;
      const maxRetries = 5;
      const baseDelay = 1000; // 1 second
      let reconnectTimeout: NodeJS.Timeout;

      const connectWebSocket = () => {
        const ws = new WebSocket(wsUrl);

        ws.addEventListener("open", () => {
          console.log("✅ WebSocket connected");
          retryCount = 0; // Reset retry count on successful connection
          wsRef.current = ws;
        });

        ws.addEventListener("message", async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "message" && data.encryptedContent) {
              // Process the received encrypted message
              await processReceivedMessage(data);
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
          }
        });

        ws.addEventListener("close", (event) => {
          console.log("🔌 WebSocket disconnected", event.code);
          wsRef.current = null;

          // Only retry if it wasn't a manual close and we haven't exceeded max retries
          if (event.code !== 1000 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
            console.log(
              `🔄 Retrying in ${delay}ms (${retryCount + 1}/${maxRetries})`
            );

            reconnectTimeout = setTimeout(() => {
              retryCount++;
              connectWebSocket();
            }, delay);
          } else if (retryCount >= maxRetries) {
            console.error("❌ Max WebSocket retry attempts reached");
          }
        });

        ws.addEventListener("error", (error) => {
          console.error("❌ WebSocket error:", error);
        });
      };

      // Initial connection
      connectWebSocket();

      // Cleanup on unmount or dependency change
      return () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (wsRef.current) {
          wsRef.current.close(1000, "Component unmounting"); // Normal closure
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

      // 1. Get our private keys
      const myKeys = await getPrivateKeys();

      // 2. Extract data from the pending conversation
      const { ephemeralKeyPublicJWK, iv, ciphertext, usedOPKId } =
        pendingConvo.initialPayload;

      // 3. Derive the shared secret using X3DH (recipient side)
      const { sharedKey } = await completeX3DHRecipient(
        ephemeralKeyPublicJWK,
        myKeys as any,
        usedOPKId
      );

      // 4. Decrypt the initial payload
      const ivArray = new Uint8Array(iv);
      const ciphertextArray = new Uint8Array(ciphertext);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivArray },
        sharedKey,
        ciphertextArray
      );

      // 5. Parse the decrypted message
      const keyMessage = JSON.parse(new TextDecoder().decode(decrypted));
      const { convSignPub, convSignPriv, convSymKey } = keyMessage;

      // 6. Generate our own signing key pair for this conversation
      const mySignKeyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      // 7. Import the symmetric key from the initiator
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

      const symKeyBytes = new Uint8Array(symKeyArray);

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

      const exportedSignPub = await window.crypto.subtle.exportKey(
        "jwk",
        importedSignPubKey
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
      await saveConversationKeys(
        pendingConvo.id,
        importedSymKey,
        {
          privateKey: importedSignPrivKey,
          publicKey: importedSignPubKey,
        },
        pendingConvo.initiatorIdentityKey, // Store initiator's signing key
        false, // We're not the initiator
        pendingConvo.type,
        group === "false" ? pendingConvo.initiatorId.toString() : undefined
      );

      // 11. Update local state
      conversationKeysRef.current = {
        convId: pendingConvo.id,
        symKey: importedSymKey,
        signKeyPair: {
          privateKey: importedSignPrivKey,
          publicKey: importedSignPubKey,
        },
        theirSignPubKey: exportedSignPub,
        type: pendingConvo.type,
      };

      setConversationId(pendingConvo.id.toString());
      setIsSessionEstablished(true);
      console.log("✅ Pending conversation processed");
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

      // Step 1: Run X3DH to establish a shared secret
      const { sharedKey, ephemeralKeyPublicJWK, usedOPKId } =
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

      // Step 7: Save the conversation keys locally
      const convId = await saveConversationKeys(
        Number(initiationResponse.conversationId),
        convSymKey,
        convSignKeyPair,
        exportedSignPub,
        true,
        "DIRECT",
        userId
      );

      // Store keys in ref for later use
      conversationKeysRef.current = {
        convId: Number(initiationResponse),
        symKey: convSymKey,
        signKeyPair: convSignKeyPair,
        theirSignPubKey: exportedSignPub,
        type: "DIRECT",
      };

      setConversationId(initiationResponse.conversationId);
      setIsSessionEstablished(true);
      console.log(`✅ New conversation initialized: ${convId}`);
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
          senderName: currentUser?.username || "Anonymous",
          timestamp: Date.now(),
        };

        wsRef.current.send(JSON.stringify(messagePayload));
        console.log("📤 Message sent");
      } else {
        console.error("❌ WebSocket not connected");
        // Optionally fall back to HTTP API
        return;
      }

      setMessage("");

      return secureMessage;
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Helper to process received messages
  const processReceivedMessage = async (message: any) => {
    if (
      !conversationKeysRef.current ||
      !conversationKeysRef.current.theirSignPubKey
    ) {
      console.error("❌ Missing conversation keys");
      return;
    }

    try {
      const { symKey } = conversationKeysRef.current;

      // Parse the encrypted content
      const secureMessage = JSON.parse(message.encryptedContent);

      // Import the recipient's public signing key if it's in JWK format
      const verificationKey: CryptoKey =
        conversationKeysRef.current.signKeyPair.publicKey;

      // Process and verify the secure message
      const { message: decryptedText, isAuthentic } =
        await processSecureMessage(secureMessage, symKey, verificationKey);

      // Add the decrypted message to the chat
      const newMessage: Message = {
        id: message.timestamp || Date.now(),
        sender: message.senderName,
        text: decryptedText,
        time: new Date(
          secureMessage.timestamp || Date.now()
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMine: +message.senderId === currentUser?.id ? true : false,
        isAuthentic:
          +message.senderId === currentUser?.id ? undefined : isAuthentic,
      };

      setChatMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error("❌ Error processing received message:", error);
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
        {chatMessages.map((msg, index) => (
          <div
            key={index}
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
              {!msg.isMine && (
                <div>
                  <p className="font-medium text-xs">{msg.sender}</p>
                  <div className="border-t border-neutral-700 my-1" />
                </div>
              )}
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
