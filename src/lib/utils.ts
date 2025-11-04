import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { queryClient } from "@/root";
import api from "./api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logout = async () => {
  try {
    // Call the logout endpoint to clear cookies on the server
    await api.post("/auth/logout");
  } catch (error) {
    console.error("Error during logout:", error);
    // Continue with local cleanup even if server request fails
  } finally {
    // Clear local data and redirect
    queryClient.clear();
    // No need to remove tokens from localStorage since we're using cookies now
    globalThis.location.href = "/";
  }
};

// Get the current user ID for use in conversations
export function getCurrentUserId(): string {
  // This should be replaced with your actual user authentication logic
  // For now, return a hardcoded value or get from localStorage if stored during login
  return localStorage.getItem("currentUserId") || "1";
}
