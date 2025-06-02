import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListUsers } from "@/features/chat/queries";
import { useCurrentUser } from "@/features/user/queries";

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup: (groupName: string, selectedUsers: number[]) => void;
}

export default function CreateGroupModal({
  open,
  onOpenChange,
  onCreateGroup,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: users } = useListUsers();
  const { data: currentUser } = useCurrentUser();

  // Filter out current user from the list
  const availableUsers = users?.filter((user) => user.id !== currentUser?.id) || [];

  const handleUserToggle = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim() || selectedUsers.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      await onCreateGroup(groupName.trim(), selectedUsers);
      
      // Reset form
      setGroupName("");
      setSelectedUsers([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName("");
    setSelectedUsers([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-neutral-200">Create Group Chat</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Create a new group chat and select members to add.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name Input */}
          <div className="space-y-2">
            <span className="text-neutral-200">
              Group Name
            </span>
            <Input
              id="groupName"
              type="text"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-neutral-800 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
              required
            />
          </div>

          {/* Members Selection */}
          <div className="space-y-2">
            <span className="text-neutral-200">
              Select Members ({selectedUsers.length} selected)
            </span>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-neutral-700 rounded-md p-3 bg-neutral-800">
              {availableUsers.length === 0 ? (
                <p className="text-neutral-400 text-sm">No users available</p>
              ) : (
                availableUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-2 hover:bg-neutral-700 rounded cursor-pointer"
                    onClick={() => handleUserToggle(user.id)}
                  >
                    <input
                      type="checkbox"
                      id={`user-${user.id}`}
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => handleUserToggle(user.id)}
                      className="border-neutral-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {user.name}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!groupName.trim() || selectedUsers.length === 0 || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}