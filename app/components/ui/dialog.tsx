import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn, getPortalContainer } from "~/utils/utils";

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal container={getPortalContainer()}>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="copa:data-[state=open]:animate-in copa:data-[state=closed]:animate-out copa:data-[state=closed]:fade-out-0 copa:data-[state=open]:fade-in-0 copa:fixed copa:inset-0 copa:z-50 copa:bg-black/50 copa:pointer-events-auto"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "copa:bg-background copa:data-[state=open]:animate-in copa:data-[state=closed]:animate-out copa:data-[state=closed]:fade-out-0 copa:data-[state=open]:fade-in-0 copa:data-[state=closed]:zoom-out-95 copa:data-[state=open]:zoom-in-95 copa:fixed copa:left-1/2 copa:top-1/2 copa:-translate-x-1/2 copa:-translate-y-1/2 copa:z-50 copa:w-[80vw] copa:rounded-md copa:shadow-lg copa:duration-200 copa:overflow-y-auto copa:grid copa:grid-rows-[auto_1fr] copa:px-6 copa:py-6",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="copa:cursor-pointer copa:ring-offset-background copa:focus:ring-ring copa:data-[state=open]:bg-accent copa:data-[state=open]:text-muted-foreground copa:absolute copa:top-4 copa:right-4 copa:rounded-md copa:opacity-70 copa:transition-opacity copa:hover:opacity-100 copa:focus:ring-2 copa:focus:ring-offset-2 copa:focus:outline-hidden copa:disabled:pointer-events-none copa:[&_svg]:pointer-events-none copa:[&_svg]:shrink-0 copa:[&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="copa:sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("copa:flex copa:flex-col copa:gap-2 copa:text-center copa:sm:text-left copa:py-3 copa:border-b copa:-mx-6 copa:px-6", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("copa:flex copa:flex-col-reverse copa:gap-2 copa:sm:flex-row copa:sm:justify-center copa:py-2 copa:border-t copa:-mx-6 copa:px-6", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("copa:text-h6 copa:leading-none copa:font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("copa:text-muted-foreground copa:text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
