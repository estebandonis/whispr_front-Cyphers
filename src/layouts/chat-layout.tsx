import CornerAccents from "@/components/corner-accents";
import { SettingsIcon, LogOut } from "lucide-react";
import { Outlet, NavLink } from "react-router";
import { cn, logout } from "@/lib/utils";

export default function ChatLayout() {
  let users = [
    {
      id: 1,
      name: "John Doe",
      lastMessage: "Hello, how are you?",
      avatar: "/avatars/john.jpg",
      time: "2:30 PM",
      unread: 3,
      status: "online",
    },
    {
      id: 2,
      name: "Emily Johnson",
      lastMessage: "Can you send me those files?",
      avatar: "/avatars/emily.jpg",
      time: "1:15 PM",
      unread: 0,
      status: "online",
    },
    {
      id: 3,
      name: "Alex Martin",
      lastMessage: "Meeting at 3pm tomorrow",
      avatar: "/avatars/alex.jpg",
      time: "Yesterday",
      unread: 0,
      status: "offline",
    },
    {
      id: 4,
      name: "Sarah Williams",
      lastMessage: "Thanks for your help!",
      avatar: "/avatars/sarah.jpg",
      time: "Yesterday",
      unread: 1,
      status: "online",
    },
    {
      id: 5,
      name: "Michael Chen",
      lastMessage: "Let's discuss the project later",
      avatar: "/avatars/michael.jpg",
      time: "Monday",
      unread: 0,
      status: "away",
    },
  ];

  let groupChats = [
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

  // Current user profile
  const currentUser = {
    id: 42,
    name: "Jamie Smith",
    email: "jamie.smith@example.com",
    avatar: "/avatars/jamie.jpg",
    status: "online",
    role: "Senior Developer",
  };

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
              Direct Messages
            </h2>
            <div className="flex flex-col ">
              {users.map((user) => (
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
                            {user.lastMessage}
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
                {currentUser.name}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {currentUser.role}
              </p>
            </div>
            <button className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded">
              <SettingsIcon className="size-4" />
            </button>
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
    </div>
  );
}
