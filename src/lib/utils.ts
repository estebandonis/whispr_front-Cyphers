import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const logout = () => {
  localStorage.setItem("jwt-token", "");
  localStorage.setItem("github-oauth-token", "");
  window.location.href = "/";
};
