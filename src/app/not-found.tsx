import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="text-base font-semibold">Esta página no existe</h1>
        <p className="text-sm text-muted-foreground">
          universe tiene una sola página: el mapa. Los mapas compartidos viajan en el enlace (<code>/#m=…</code>), no en
          la ruta.
        </p>
        <Button asChild className="max-md:h-10">
          <Link href="/">Ir al mapa</Link>
        </Button>
      </div>
    </main>
  );
}
