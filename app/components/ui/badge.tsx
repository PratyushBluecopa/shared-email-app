import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/utils/utils";

const badgeVariants = cva(
  "copa:inline-flex copa:items-center copa:justify-center copa:rounded-md copa:border copa:px-2 copa:py-0.5 copa:text-xs copa:font-medium copa:w-fit copa:whitespace-nowrap copa:shrink-0 copa:gap-1 copa:[&>svg]:size-3 copa:[&>svg]:pointer-events-none copa:overflow-hidden",
  {
    variants: {
      variant: {
        default: "copa:border-transparent copa:bg-primary copa:text-primary-foreground",
        secondary: "copa:border-transparent copa:bg-secondary copa:text-secondary-foreground",
        destructive: "copa:border-transparent copa:bg-destructive copa:text-white",
        outline: "copa:text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
