import * as React from "react";

import { cn } from "~/utils/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "copa:glass-card copa:rounded-md copa:text-card-foreground copa:flex copa:flex-col copa:shadow-soft copa:px-6 copa:py-4",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "copa:@container/card-header copa:grid copa:auto-rows-min copa:grid-rows-[auto_auto] copa:items-start copa:has-data-[slot=card-action]:grid-cols-[1fr_auto] copa:border-b copa:border-gray-100/50",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("copa:text-[15px] copa:leading-none copa:font-semibold copa:text-gray-900", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("copa:text-gray-500 copa:text-sm copa:mt-1", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "copa:col-start-2 copa:row-span-2 copa:row-start-1 copa:self-start copa:justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("copa:flex copa:items-center copa:border-t copa:border-gray-100/50", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
