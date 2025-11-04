import api from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getCurrentUserId } from "@/lib/utils";

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
  options?: { enabled?: boolean; disabled?: boolean }
) => {
  return useQuery({
    queryKey: ["keyBundle", userId],
    queryFn: async () => {
      const { data } = await api.get(`/user/${userId}/keybundle`);
      return data;
    },
    enabled: options?.enabled ?? !!userId, // Use provided enabled option or default to !!userId
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

export const useInitiateGroupConversation = () => {
  return useMutation({
    mutationFn: async ({
      name,
      members,
    }: {
      name: string;
      members: {
        id: number;
        payload: {
          iv: number[];
          ciphertext: number[];
          ephemeralKeyPublicJWK: any;
          usedOPKId?: string | number;
          initiatorId: string;
        };
      }[];
    }) => {
      const { data } = await api.post(`/conversations/group`, {
        name: name,
        members: members,
      });
      return data;
    },
  });
};

export const useGetGroupConversations = () => {
  return useQuery({
    queryKey: ["groupConversations"],
    queryFn: async () => {
      const { data } = await api.get(`/conversations/group`);
      return data;
    },
    enabled: true, // Always enabled to fetch group conversations
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
export const useGetConversationMessages = (
  conversationId: string,
  isDirectMessage: boolean
) => {
  return useQuery({
    queryKey: ["messages", conversationId, isDirectMessage],
    queryFn: async () => {
      const { data } = await api.get(
        `/conversations/${conversationId}/messages`,
        {
          params: {
            isDirectMessage: isDirectMessage,
          },
        }
      );
      return data;
    },
    enabled: !!conversationId,
  });
};

// Fetch pending conversations where the user is the recipient
export const useGetPendingConversations = (
  userId?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ["pendingConversations", userId],
    queryFn: async () => {
      const { data } = await api.get(`/conversations/pending`);
      return data;
    },
    enabled: options?.enabled ?? !!userId,
  });
};

// Accept a conversation and send back signing public key
export const useAcceptConversation = () => {
  return useMutation({
    mutationFn: async ({
      conversationId,
      signingPublicKey,
    }: {
      conversationId: string | number;
      signingPublicKey: any; // JWK format
    }) => {
      const { data } = await api.put(
        `/conversations/${conversationId}/accept`,
        {
          signingPublicKey,
          responderId: getCurrentUserId(),
          status: "FINISHED",
        }
      );
      return data;
    },
  });
};

export const useDeleteUser = () => {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/user`);
      return data;
    },
  });
};
