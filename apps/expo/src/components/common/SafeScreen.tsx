import type { ComponentProps, ReactNode } from "react";
import type { Edge } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@acme/ui";

const DEFAULT_EDGES: readonly Edge[] = ["top", "bottom"];

interface SafeScreenProps extends ComponentProps<typeof SafeAreaView> {
  children: ReactNode;
  edges?: readonly Edge[];
}

export function SafeScreen({
  children,
  className,
  edges = DEFAULT_EDGES,
  ...props
}: SafeScreenProps) {
  return (
    <SafeAreaView
      className={cn("flex-1", className)}
      edges={edges}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}
