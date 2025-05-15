import { Outlet } from "react-router";
import { useEffect, useState } from "react";
import { initializeX3DH } from "@/lib/crypto";

export default function MainLayout() {
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    const initializeCrypto = async () => {
      try {
        // Check if keys already exist
        const hasKeys = localStorage.getItem("x3dh_keys") !== null;

        if (!hasKeys && !isInitializing) {
          setIsInitializing(true);
          console.log("Initializing X3DH keys...");

          const { publicBundle } = await initializeX3DH();

          console.log("Public bundle:", publicBundle);

          // Send public keys to server in the required format
          const response = await fetch("http://localhost:3000/user/keybundle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publicBundle),
          });

          if (response.ok) {
            console.log("Keys registered with the server successfully");
          } else {
            console.error(
              "Failed to register keys with server:",
              await response.text()
            );
          }

          setIsInitializing(false);
        }
      } catch (error) {
        console.error("Failed to initialize or register keys:", error);
        setIsInitializing(false);
      }
    };

    initializeCrypto();
  }, []);

  return (
    <div className="bg-neutral-950 h-screen w-full text-white font-body">
      <Outlet />
    </div>
  );
}
