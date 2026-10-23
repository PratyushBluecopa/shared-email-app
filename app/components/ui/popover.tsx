import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn, getPortalContainer } from "~/utils/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal container={getPortalContainer()}>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "copa:z-50 copa:w-72 copa:rounded-md copa:border copa:bg-popover copa:p-4 copa:text-popover-foreground copa:shadow-md copa:outline-none copa:data-[state=open]:animate-in copa:data-[state=closed]:animate-out copa:data-[state=closed]:fade-out-0 copa:data-[state=open]:fade-in-0 copa:data-[state=closed]:zoom-out-95 copa:data-[state=open]:zoom-in-95 copa:data-[side=bottom]:slide-in-from-top-2 copa:data-[side=left]:slide-in-from-right-2 copa:data-[side=right]:slide-in-from-left-2 copa:data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
