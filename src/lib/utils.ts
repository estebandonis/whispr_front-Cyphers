import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { queryClient } from "@/root";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logout = () => {
  queryClient.clear();
  localStorage.removeItem("access_token");
  window.location.href = "/";
};
