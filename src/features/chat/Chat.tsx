import { useParams } from "react-router";
import { Input } from "@/components/ui/input";
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import CornerAccents from "@/components/corner-accents";
export default function Chat() {
  const { id } = useParams();
  const [message, setMessage] = useState("");

  // Dummy messages for display
  const messages = [
    {
      id: 1,
      sender: "John Doe",
      text: "Hey, how's it going?",
      time: "10:30",
      isMine: false,
    },
    {
      id: 2,
      sender: "You",
      text: "Pretty good! Working on that project we discussed.",
      time: "10:32",
      isMine: true,
    },
    {
      id: 3,
      sender: "John Doe",
      text: "Great! Let me know when you need feedback.",
      time: "10:33",
      isMine: false,
    },
  ];

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (message.trim()) {
      // Here you would add logic to send the message
      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 border-b border-neutral-800">
        <h1 className="text-xl font-heading  tracking-tighter  font-medium uppercase text-neutral-300">
          {id}
        </h1>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto   p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex relative ${
              msg.isMine ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] border-dashed  leading-loose px-3 py-2 rounded-md ${
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
        <div className="flex gap-0 w-full h-[73px]  mx-auto">
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
          >
            →
          </Button>
        </div>
      </form>
    </div>
  );
}
