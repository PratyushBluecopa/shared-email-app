"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "~/utils/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(className, "copa:flex copa:flex-col copa:gap-4")}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(className, "copa:flex copa:flex-wrap copa:items-center copa:gap-1 copa:border-b copa:border-border copa:w-full copa:bg-transparent copa:p-0")}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(className, "copa:relative copa:inline-flex copa:items-center copa:justify-center copa:gap-2 copa:whitespace-nowrap copa:rounded-t-md copa:px-4 copa:h-10 copa:text-sm copa:font-medium copa:text-muted-foreground copa:transition-colors copa:hover:text-foreground copa:hover:bg-accent/40 copa:focus-visible:outline-none copa:focus-visible:ring-2 copa:focus-visible:ring-ring/30 copa:data-[state=active]:text-primary copa:data-[state=active]:font-semibold copa:data-[state=active]:after:content-[''] copa:data-[state=active]:after:absolute copa:data-[state=active]:after:left-2 copa:data-[state=active]:after:right-2 copa:data-[state=active]:after:-bottom-px copa:data-[state=active]:after:h-[2px] copa:data-[state=active]:after:bg-primary copa:data-[state=active]:after:rounded-full copa:data-[disabled]:opacity-50 copa:data-[disabled]:pointer-events-none copa:cursor-pointer")}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(className, "copa:flex-1 copa:outline-none copa:overflow-visible")}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
