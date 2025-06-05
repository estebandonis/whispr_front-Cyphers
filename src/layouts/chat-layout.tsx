import CornerAccents from "@/components/corner-accents";
import { SettingsIcon, LogOut, Delete } from "lucide-react";
import { Outlet, NavLink, Link } from "react-router";
import { cn, logout } from "@/lib/utils";
import { useDeleteUser, useListUsers } from "@/features/chat/queries";
import { useCurrentUser } from "@/features/user/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Loading from "@/features/loading";
import MfaResetDialog from "@/components/mfa-reset-dialog";
import CreateGroupModal from "@/components/create-group-chat";
import { useState } from "react";
import {
  initializeX3DHSession,
} from "@/lib/crypto";
import {
  useInitiateGroupConversation,
  useGetGroupConversations
} from "../features/chat/queries";
import {
  saveConversationKeys,
} from "@/lib/conversation-store";
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export default function ChatLayout() {
  const { data: users } = useListUsers();
  const { data: currentUser } = useCurrentUser();
  const { mutateAsync: initiateGroupConversation } = useInitiateGroupConversation();
  const { data: groupChats } = useGetGroupConversations();
  const { mutateAsync: deleteUser, isSuccess: userDeleted } = useDeleteUser();
  const queryClient = useQueryClient();

  const [mfaResetDialog, setMfaResetDialog] = useState<boolean>(false);
  const [createGroupModal, setCreateGroupModal] = useState<boolean>(false); // Add this state

  const createGroupChat = async () => {
    setCreateGroupModal(true); // Open the modal instead of empty function
  };

  // const groupChats = [
  //   {
  //     id: 1,
  //     name: "Project Alpha",
  //     lastMessage: "Alex: I've updated the designs",
  //     avatar: "/groups/alpha.jpg",
  //     time: "3:45 PM",
  //     unread: 7,
  //     members: 5,
  //   },
  //   {
  //     id: 2,
  //     name: "Design Team",
  //     lastMessage: "Sarah: Check out this new tool",
  //     avatar: "/groups/design.jpg",
  //     time: "11:30 AM",
  //     unread: 0,
  //     members: 8,
  //   },
  //   {
  //     id: 3,
  //     name: "Weekend Plans",
  //     lastMessage: "Emily: Who's free on Saturday?",
  //     avatar: "/groups/weekend.jpg",
  //     time: "Yesterday",
  //     unread: 2,
  //     members: 4,
  //   },
  // ];

  const handleCreateGroupChat = async (name: string, userIds: number[]) => {
    const members = []

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

    for (const userId of userIds) {
      const userBundle = await queryClient.fetchQuery({
            queryKey: ['userKeyBundle', userId.toString()],
            queryFn: async () => {
              const { data } = await api.get(`/user/${userId}/keybundle`);
              return data;
            },
            staleTime: 5 * 60 * 1000, // Cache for 5 minutes
          });

      if (!userBundle) {
        console.error(`User key bundle not found for user ID: ${userId}`);
        continue; // Skip this user if their key bundle is not available
      }

      const { sharedKey, ephemeralKeyPublicJWK, usedOPKId } = await initializeX3DHSession(userBundle);

      // Step 5: Encrypt the key message with the shared secret from X3DH
      const encoded = new TextEncoder().encode(JSON.stringify(keyMessage));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sharedKey,
        encoded
      );

      members.push({
        id: userId,
        payload: {
          iv: Array.from(iv),
          ciphertext: Array.from(new Uint8Array(encrypted)),
          ephemeralKeyPublicJWK,
          usedOPKId,
          initiatorId: currentUser?.id?.toString() || "", // Use current user ID
        },
      });
    }

    const initiationResponse = await initiateGroupConversation({
      name: name,
      members: members,
    });

    // Step 7: Save the conversation keys locally
    const convId = await saveConversationKeys(
      Number(initiationResponse.conversationId),
      convSymKey,
      convSignKeyPair,
      exportedSignPub,
      true,
      "GROUP"
    );

    console.log("Group chat created with ID:", convId);

    queryClient.invalidateQueries({ queryKey: ['groupConversations'] });
  }

  const handleDeleteUser = async() => {
    await deleteUser();

    if (userDeleted) {
      // Clear local storage and redirect to login
      localStorage.clear();
      queryClient.clear();

      // Optionally, you can redirect to the login page
      window.location.href = "/";
    }
  }

  if (!users) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen">
      <aside className="w-80 flex flex-col bg-neutral-900 border-r border-neutral-800">
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-xl font-heading  tracking-tighter  font-medium uppercase text-neutral-300">
            Whispr
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto  p-4 space-y-6">
          {/* Users */}
          <div>
            <h2 className="text-xs uppercase font-medium text-neutral-500 mb-3">
              {users?.filter((user) => user.id !== currentUser?.id).length}{" "}
              Users
            </h2>
            <div className="flex flex-col ">
              {users
                ?.filter((user) => user.id !== currentUser?.id)
                .map((user) => (
                  <NavLink
                    key={user.id}
                    to={`/chat/${user.id}/${"false"}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center relative group gap-3 p-2  hover:bg-neutral-800 cursor-pointer transition-colors duration-150",
                        isActive && "bg-neutral-800"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <CornerAccents
                          className={`opacity-0  group-hover:opacity-100 transition-all duration-300 ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 py-1 flex flex-col min-w-0 gap-1">
                          <div className="flex justify-between items-baseline">
                            <p className="text-sm font-normal font-heading text-neutral-200 truncate">
                              {user.name}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
            </div>
          </div>

          {/* Group chats */}
          <div>
            <h2 className="text-xs uppercase font-medium text-neutral-500 mb-3">
              Group Chats
            </h2>
            <div className="flex flex-col ">
              {(groupChats && groupChats.length > 0)  && groupChats.map((group: any, index: number) => (
                <NavLink
                    key={index}
                    to={`/chat/${group.id}/${"true"}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center relative group gap-3 p-2  hover:bg-neutral-800 cursor-pointer transition-colors duration-150",
                        isActive && "bg-neutral-800"
                      )
                    }
                  >
                  {({ isActive }) => (
                    <>
                      <CornerAccents className={`group-hover:opacity-100 transition-all duration-300 ${isActive ? "opacity-100" : "opacity-0"}`} />
                        <div className="flex-1 py-1 flex flex-col min-w-0 gap-1">
                          <div className="flex justify-between items-baseline">
                            <p className="text-sm font-normal font-heading text-neutral-200 truncate">
                              {group.name}
                            </p>
                            <p className="text-xs text-neutral-500">{100}</p>
                          </div>
                        <div className="flex justify-between items-center">
                        <p className="text-xs text-neutral-400 truncate">
                          {""}
                        </p>
                      </div>
                    </div>
                  </>
                  )}
              </NavLink>
              ))}
              <button
                onClick={createGroupChat}
                className="flex items-center gap-2 p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors duration-150"
              >
                <SettingsIcon className="size-4" />
                <span className="text-sm font-normal font-heading">
                  Create Group Chat
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Current user profile */}
        <div className="p-4 border-t border-neutral-800 mt-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden">
                {/* Placeholder for avatar */}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-neutral-900"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-normal font-heading text-neutral-200 truncate">
                {currentUser?.name || "Loading..."}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {currentUser?.username || ""}
              </p>
            </div>
            {/* <button className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded">
              <SettingsIcon className="size-4" />
            </button> */}
            <DropdownMenu>
              <DropdownMenuTrigger className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded cursor-pointer">
                <SettingsIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer p-0">
                  <Link to="/mfa/setup" className="w-full h-full p-2">
                    Setup MFA
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setMfaResetDialog(true)}
                >
                  Disable MFA
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={logout}
              type="button"
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
            <button
              onClick={handleDeleteUser}
              type="button"
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded cursor-pointer"
              >
              <Delete className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-neutral-950">
        <Outlet />
      </main>

      <MfaResetDialog open={mfaResetDialog} onOpenChange={setMfaResetDialog} />
      <CreateGroupModal
        open={createGroupModal}
        onOpenChange={setCreateGroupModal}
        onCreateGroup={handleCreateGroupChat}
      />
    </div>
  );
}
