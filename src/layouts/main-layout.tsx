import { useCurrentUser } from "@/features/user/queries";
import { initializeX3DH } from "@/lib/crypto";
import api from "@/lib/api";
import { useEffect, useRef } from "react";
import { Outlet } from "react-router";
import { toast } from "sonner";

export default function MainLayout() {
  const { data: user } = useCurrentUser();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const initializeKeys = async () => {
      if (hasInitialized.current || !user) {
        return;
      }

      try {
        const hasKeys = localStorage.getItem("x3dh_keys") !== null;

        if (hasKeys === false) {
          const { publicBundle } = await initializeX3DH();

          await api.post(`/user/${user.id}/keybundle`, publicBundle);

          hasInitialized.current = true;
        } else {
          hasInitialized.current = true;
        }
      } catch {
        toast.error("Failed to initialize or register keys");
      }
    };

    if (user && !hasInitialized.current) {
      initializeKeys();
    }
  }, [user]);

  return (
    <div className="bg-neutral-950 h-screen w-full text-white font-body">
      <Outlet />
    </div>
  );
}
