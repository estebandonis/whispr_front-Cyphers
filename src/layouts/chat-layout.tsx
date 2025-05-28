import CornerAccents from "@/components/corner-accents";
import { SettingsIcon, LogOut } from "lucide-react";
import { Outlet, NavLink, Link } from "react-router";
import { cn, logout } from "@/lib/utils";
import { useListUsers } from "@/features/chat/queries";
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
import { useState } from "react";

export default function ChatLayout() {
  const { data: users } = useListUsers();
  const { data: currentUser } = useCurrentUser();

  const [mfaResetDialog, setMfaResetDialog] = useState<boolean>(false);

  const groupChats = [
    {
      id: 1,
      name: "Project Alpha",
      lastMessage: "Alex: I've updated the designs",
      avatar: "/groups/alpha.jpg",
      time: "3:45 PM",
      unread: 7,
      members: 5,
    },
    {
      id: 2,
      name: "Design Team",
      lastMessage: "Sarah: Check out this new tool",
      avatar: "/groups/design.jpg",
      time: "11:30 AM",
      unread: 0,
      members: 8,
    },
    {
      id: 3,
      name: "Weekend Plans",
      lastMessage: "Emily: Who's free on Saturday?",
      avatar: "/groups/weekend.jpg",
      time: "Yesterday",
      unread: 2,
      members: 4,
    },
  ];

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
                    to={`/chat/${user.id}`}
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
                            <p className="text-xs text-neutral-500">
                              {user.time}
                            </p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-neutral-400 truncate">
                              {user.username}
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
              {groupChats.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center relative group  p-2  hover:bg-neutral-800 cursor-pointer transition-colors duration-150 "
                >
                  <CornerAccents className="opacity-0  group-hover:opacity-100 transition-all duration-300 " />
                  <div className="flex-1 py-1 flex flex-col min-w-0 gap-1">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-normal font-heading text-neutral-200 truncate">
                        {group.name}
                      </p>
                      <p className="text-xs text-neutral-500">{group.time}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-neutral-400 truncate">
                        {group.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
                <DropdownMenuItem>
                  <Link to="/mfa/setup">Setup MFA</Link>
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
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-neutral-950">
        <Outlet />
      </main>

      <MfaResetDialog open={mfaResetDialog} onOpenChange={setMfaResetDialog} />
    </div>
  );
}
