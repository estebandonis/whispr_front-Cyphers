import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logout = () => {
  localStorage.removeItem("jwt-token");
  localStorage.removeItem("github-oauth-token");
  window.location.href = "/";
};
