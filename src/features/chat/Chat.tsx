import { useParams } from "react-router";
import { Input } from "@/components/ui/input";
import { useState, FormEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { hc } from "hono/client";
import {
  initializeX3DHSession,
  encryptMessage,
  decryptMessage,
} from "@/lib/crypto";

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isMine: boolean;
}

export default function Chat() {
  const { id } = useParams();
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isSessionEstablished, setIsSessionEstablished] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    if (!id) return;

    // Establish secure session with the recipient
    const establishSecureSession = async () => {
      try {
        // Fetch recipient's public key bundle
        const response = await fetch(`http://localhost:3000/user/1/keybundle`);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch recipient's keys: ${response.statusText}`
          );
        }

        const recipientPublicBundle = await response.json();
        console.log("Recipient's key bundle:", recipientPublicBundle);

        // Initialize X3DH session with recipient
        const sessionData = await initializeX3DHSession(recipientPublicBundle);

        // For this simplified example, we're assuming the session key is directly usable
        // In a real implementation, you'd derive a message encryption key from the session
        sessionKeyRef.current =
          sessionData.ephemeralKey as unknown as CryptoKey;

        console.log("Secure session established");
        setIsSessionEstablished(true);

        // Now connect to WebSocket
        connectWebSocket();
      } catch (error) {
        console.error("Failed to establish secure session:", error);
      }
    };

    establishSecureSession();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id]);

  const connectWebSocket = () => {
    console.log("Connecting to WebSocket...");
    const client = hc("http://localhost:3000/message");
    const ws = client.ws.$ws(0);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      console.log("WebSocket connection opened");
    });

    ws.addEventListener("join", () => {
      console.log("Joined the chat");
    });

    ws.addEventListener("message", async (event) => {
      console.log("Received message: ", event.data);
      try {
        // Parse the message data
        const messageData = JSON.parse(event.data);

        // If it's an encrypted message, decrypt it
        if (messageData.encrypted && sessionKeyRef.current) {
          const decryptedText = await decryptMessage(
            messageData.text,
            sessionKeyRef.current
          );

          // Add the decrypted message to the chat
          const newMessage: Message = {
            id: messageData.id || Date.now(),
            sender: messageData.sender,
            text: decryptedText,
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isMine: false,
          };

          setChatMessages((prev) => [...prev, newMessage]);
        }
      } catch (error) {
        console.error("Error processing received message:", error);
      }
    });

    ws.addEventListener("close", () => {
      console.log("WebSocket connection closed");
    });
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || !wsRef.current || !sessionKeyRef.current) return;

    try {
      // 1. Encrypt the message using the session key
      const encryptedText = await encryptMessage(
        message,
        sessionKeyRef.current
      );

      // 2. Construct the message object
      const messageObj = {
        sender: "You",
        recipient: id,
        text: encryptedText,
        encrypted: true,
        timestamp: Date.now(),
      };

      // 3. Send the encrypted message over WebSocket
      wsRef.current.send(JSON.stringify(messageObj));

      // 4. Add the message to the local chat (unencrypted for display)
      const newMessage: Message = {
        id: Date.now(),
        sender: "You",
        text: message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMine: true,
      };

      setChatMessages((prev) => [...prev, newMessage]);

      // 5. Clear the input field
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 border-b border-neutral-800">
        <h1 className="text-xl font-heading tracking-tighter font-medium uppercase text-neutral-300">
          {id}
        </h1>
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
              <span className="text-xs text-neutral-500 mt-1 block text-right">
                {msg.time}
              </span>
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
