"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-dvh w-full items-center justify-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h1 className="text-base font-semibold">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">
          No pudimos mostrar el mapa. Reintenta; si sigue fallando, recarga la página.
        </p>
        <Button onClick={() => retry()}>Reintentar</Button>
      </div>
    </main>
  );
}
