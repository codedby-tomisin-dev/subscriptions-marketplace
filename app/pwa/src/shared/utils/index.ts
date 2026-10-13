import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export * from "./csv";
export * from "./dates";
export * from "./money";
export * from "./scroll";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
