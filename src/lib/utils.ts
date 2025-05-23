import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { queryClient } from "@/root";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logout = () => {
  queryClient.clear();
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/";
};

// Get the current user ID for use in conversations
export function getCurrentUserId(): string {
  // This should be replaced with your actual user authentication logic
  // For now, return a hardcoded value or get from localStorage if stored during login
  return localStorage.getItem("currentUserId") || "1";
}
