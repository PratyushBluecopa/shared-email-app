import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  prefix: "copa",
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Radix portal target: the MFE root, so portalled content keeps the scoped theme vars. */
export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".mfe-root") ?? undefined;
}
