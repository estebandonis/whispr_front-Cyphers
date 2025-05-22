import api from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
}
async function fetchUsers() {
  const { data } = await api.get<User[]>("/user");
  return data;
}

export const useListUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
};

// Fetch a user's key bundle
export const useGetUserKeyBundle = (
  userId: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["keyBundle", userId],
    queryFn: async () => {
      const { data } = await api.get(`/user/${userId}/keybundle`);
      return data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!userId, // Use provided enabled option or default to !!userId
  });
};

// Create a new conversation with initial key exchange
export const useInitiateConversation = () => {
  return useMutation({
    mutationFn: async ({
      recipientId,
      payload,
    }: {
      recipientId: string;
      payload: {
        iv: number[];
        ciphertext: number[];
        ephemeralKeyPublicJWK: any;
        usedOPKId?: string | number;
        initiatorId: string;
      };
    }) => {
      const { data } = await api.post(`/conversations/initiate`, {
        to: recipientId,
        from: payload.initiatorId,
        payload: {
          iv: payload.iv,
          ciphertext: payload.ciphertext,
          ephemeralKeyPublicJWK: payload.ephemeralKeyPublicJWK,
          usedOPKId: payload.usedOPKId,
        },
      });
      return data;
    },
  });
};

// Send a message in an existing conversation
export const useSendMessage = () => {
  return useMutation({
    mutationFn: async ({
      conversationId,
      message,
      encryptedContent,
      senderId,
    }: {
      conversationId: string;
      message: string;
      encryptedContent: string;
      senderId: string;
    }) => {
      const { data } = await api.post(
        `/conversations/${conversationId}/messages`,
        {
          senderId,
          content: message,
          encryptedContent,
        }
      );
      return data;
    },
  });
};

// Fetch messages for a conversation
export const useGetConversationMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`
      );
      return data;
    },
    enabled: !!conversationId,
  });
};
