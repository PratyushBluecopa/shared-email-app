import type { ComponentProps } from "react";

import { cn } from "~/utils/utils";

// Mirrors the cash app's Badge: `variant` is accepted for API compatibility but,
// like the cash original, does not change the styling.
function Badge({
  className,
  variant: _variant,
  ...props
}: ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "copa:inline-flex copa:items-center copa:justify-center copa:rounded-md copa:border copa:px-2 copa:py-0.5 copa:text-xs copa:font-medium copa:w-fit copa:whitespace-nowrap copa:shrink-0 copa:[&>svg]:size-3 copa:gap-1 copa:[&>svg]:pointer-events-none copa:focus-visible:border-ring copa:focus-visible:ring-ring/50 copa:focus-visible:ring-[3px] copa:aria-invalid:ring-destructive/20 copa:dark:aria-invalid:ring-destructive/40 copa:aria-invalid:border-destructive copa:transition-[color,box-shadow] copa:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
