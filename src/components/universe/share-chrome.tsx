"use client";

import { CircleAlert, Copy, FileUp, Link2, Save, Share2, X } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { download, imageFrame, renderMapPng } from "@/lib/export-image";
import { mapToJson, MAX_IMPORT_BYTES, parseImportText, slugify } from "@/lib/io";
import type { SystemMap } from "@/lib/schema";
import { SHARE_URL_WARN_LENGTH, shareUrl } from "@/lib/share";
import { currentMap, SHARED_ID, useMapStore } from "@/store/map-store";

const MAX_LISTED_ERRORS = 12;
const PASTED = "el texto pegado";

/** "Compartir": copies a link with the map inside the hash and shows it in a dialog. */
export function ShareButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const inputId = useId();

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard permission (or not a secure context): the link stays selectable in the dialog.
      setCopied(false);
    }
  }, []);

  const onOpenChange = (next: boolean) => {
    if (!next) {
      setUrl(null);
      return;
    }
    const link = shareUrl(currentMap(useMapStore.getState()), window.location.href);
    setUrl(link);
    setCopied(null);
    void copy(link);
  };

  const long = url !== null && url.length > SHARE_URL_WARN_LENGTH;
  return (
    // With a trigger, Radix gives focus back to "Compartir" on close.
    <Dialog open={url !== null} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-background max-md:size-10 max-md:px-0"
          aria-label="Compartir"
          data-testid="share-button"
        >
          <Share2 />
          <span className="max-md:sr-only">Compartir</span>
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>Compartir mapa</DialogTitle>
          <DialogDescription>
            Quien abra el enlace verá este mapa en modo Ver y podrá guardarlo en sus mapas. El mapa va dentro del
            enlace: no se sube a ningún servidor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={inputId}>Enlace</Label>
          <Input
            id={inputId}
            readOnly
            value={url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
            data-testid="share-url"
          />
          <p role="status" className="text-xs text-muted-foreground" data-testid="share-status">
            {copied === true
              ? "Enlace copiado al portapapeles."
              : copied === false
                ? "No se pudo copiar automáticamente: selecciona el enlace y cópialo."
                : ""}
          </p>
          {long && (
            <p className="flex items-start gap-1.5 text-xs text-foreground" data-testid="share-long">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
              El enlace tiene {url.length.toLocaleString("es")} caracteres (más de{" "}
              {SHARE_URL_WARN_LENGTH.toLocaleString("es")}): algunas apps y navegadores pueden cortarlo. Para mapas
              grandes, usa «Exportar JSON».
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setUrl(null)}>
            Cerrar
          </Button>
          <Button onClick={() => url && void copy(url)}>
            <Copy /> Copiar enlace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrorList({ title, items }: { title: string; items: string[] }) {
  const shown = items.slice(0, MAX_LISTED_ERRORS);
  return (
    <div role="alert" data-testid="import-errors" className="flex flex-col gap-1 text-xs text-destructive">
      <p className="font-medium">{title}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 break-words">
        {shown.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {items.length > shown.length && <li>y {items.length - shown.length} más.</li>}
      </ul>
    </div>
  );
}

/** Imports a map from a JSON file or pasted text into "Mis mapas". */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importMap = useMapStore((s) => s.importMap);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<{ title: string; items: string[]; fromText: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const textId = useId();

  const close = (next: boolean) => {
    if (!next) {
      setText("");
      setErrors(null);
    }
    onOpenChange(next);
  };

  const tryImport = (raw: string, source: string) => {
    const result = parseImportText(raw);
    if (!result.ok) {
      setErrors({ title: `No se pudo importar ${source}:`, items: result.errors, fromText: source === PASTED });
      return;
    }
    importMap(result.map, result.problems);
    close(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setErrors({ title: `No se pudo importar «${file.name}»:`, items: ["El archivo pesa más de 5 MB."], fromText: false });
      return;
    }
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setErrors({ title: `No se pudo importar «${file.name}»:`, items: ["No se pudo leer el archivo."], fromText: false });
      return;
    }
    tryImport(raw, `«${file.name}»`);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        data-testid="import-dialog"
        className="max-h-[90svh] overflow-y-auto"
        // Opened from the map menu, which is gone by now: give focus back to its trigger.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('[data-testid="map-menu"]')?.focus();
        }}
      >
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            tryImport(text, PASTED);
          }}
        >
          <DialogHeader>
            <DialogTitle>Importar JSON</DialogTitle>
            <DialogDescription>
              El mapa se valida con el esquema y se añade a «Mis mapas» como un mapa nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-start gap-1.5">
            {/* The native file input says "Choose File" in the browser's language: a Spanish button opens it. */}
            <p id={fileId} className="text-sm leading-none font-medium">
              Desde un archivo
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="import-file"
              onChange={(e) => {
                void onFile(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="max-md:h-10"
              aria-describedby={fileId}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp /> Elegir archivo JSON…
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={textId}>O pega el JSON</Label>
            <Textarea
              id={textId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='{ "version": 1, "title": "…", "summary": "", "nodes": [], "edges": [] }'
              className="max-h-48 min-h-24 font-mono text-xs"
              spellCheck={false}
              aria-invalid={errors?.fromText ?? false}
              data-testid="import-text"
            />
          </div>
          {errors && <ErrorList title={errors.title} items={errors.items} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" data-testid="import-submit">
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Downloads `<slug>.json` with the exact map. */
export function exportJson(map: SystemMap) {
  const url = URL.createObjectURL(new Blob([mapToJson(map)], { type: "application/json" }));
  download(url, `${slugify(map.title)}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  useMapStore.getState().announce(`JSON exportado: ${slugify(map.title)}.json`);
}

/** Downloads `<slug>.png` with every node of the map, at 2x, on the theme's background. */
export async function exportPng(map: SystemMap) {
  const { announce, showAlert } = useMapStore.getState();
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) {
    showAlert("No se pudo exportar la imagen", ["El canvas todavía no está listo. Inténtalo de nuevo."]);
    return;
  }
  announce("Exportando imagen…");
  try {
    const background = getComputedStyle(document.body).backgroundColor;
    const png = await renderMapPng(viewport, imageFrame(map), background);
    download(png, `${slugify(map.title)}.png`);
    announce(`Imagen exportada: ${slugify(map.title)}.png`);
  } catch (error) {
    showAlert("No se pudo exportar la imagen", [error instanceof Error ? error.message : String(error)]);
  }
}

/** Shown while the map on screen comes from a link: read-only, with "Guardar en mis mapas". */
export function SharedBanner() {
  const shared = useMapStore((s) => (s.mapId === SHARED_ID ? s.shared : null));
  const save = useMapStore((s) => s.saveShared);
  if (!shared) return null;
  const count = shared.problems.length;
  return (
    <div
      data-testid="shared-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted px-3 py-1.5 text-xs text-foreground"
    >
      <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        Mapa compartido por enlace, de solo lectura. Guárdalo en tus mapas para editarlo.
        {count > 0 &&
          ` Tiene ${count} ${count === 1 ? "problema" : "problemas"} del camino principal; se verán en el panel al editar.`}
      </p>
      <Button size="sm" className="max-md:h-10" onClick={() => save()} data-testid="save-shared">
        <Save /> Guardar en mis mapas
      </Button>
    </div>
  );
}

/** Visible error with its details (a link that could not be opened, a failed export). */
export function AlertBanner() {
  const alert = useMapStore((s) => s.alert);
  const dismiss = useMapStore((s) => s.dismissAlert);
  if (!alert) return null;
  return (
    <div
      role="alert"
      data-testid="alert-banner"
      className="flex items-start gap-2 border-b bg-muted px-3 py-1.5 text-xs text-foreground"
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1 py-1">
        <p className="font-medium">{alert.title}</p>
        <ul className="break-words">
          {alert.items.slice(0, MAX_LISTED_ERRORS).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
      <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label="Cerrar aviso" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}
