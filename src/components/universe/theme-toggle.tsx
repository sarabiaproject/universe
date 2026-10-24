"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const value = mounted ? (resolvedTheme ?? "light") : "light";

  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => v && setTheme(v)}
      aria-label="Tema"
      data-testid="theme-toggle"
      className="bg-background"
    >
      <ToggleGroupItem value="light" aria-label="Modo claro" className="max-md:h-10 max-md:min-w-10">
        <Sun />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Modo oscuro" className="max-md:h-10 max-md:min-w-10">
        <Moon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
