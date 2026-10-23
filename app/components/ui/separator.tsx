import * as React from "react";

import { cn } from "~/utils/utils";

// Decorative separator (same classes as the cash app's Radix one, without the extra dependency).
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="none"
      data-slot="separator"
      data-orientation={orientation}
      className={cn(
        "copa:bg-border copa:shrink-0 copa:data-[orientation=horizontal]:h-px copa:data-[orientation=horizontal]:w-full copa:data-[orientation=vertical]:h-full copa:data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
