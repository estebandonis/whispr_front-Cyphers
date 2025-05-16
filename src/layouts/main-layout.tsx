import { initializeX3DH } from "@/lib/crypto";
import { useEffect } from "react";
import { Outlet } from "react-router";
// import { api } from "@/lib/api";
export default function MainLayout() {
  useEffect(() => {
    const initializeKeys = async () => {
      try {
        const hasKeys = localStorage.getItem("x3dh_keys") !== null;

        if (!hasKeys) {
          const { publicBundle } = await initializeX3DH();

          const response = await fetch(
            "http://localhost:3000/user/1/keybundle",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(publicBundle),
            }
          );

          if (response.ok) {
            console.log("Keys registered with the server successfully");
          } else {
            console.error(
              "Failed to register keys with server:",
              await response.text()
            );
          }
        } else {
          console.log("Keys already exist, skipping initialization");
        }
      } catch (error) {
        console.error("Failed to initialize or register keys:", error);
      }
    };

    initializeKeys();
  }, []);

  return (
    <div className="bg-neutral-950 h-screen w-full text-white font-body">
      <Outlet />
    </div>
  );
}
