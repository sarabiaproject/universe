"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUNDLED_MAPS } from "@/maps";
import { SHARED_ID, useMapStore } from "@/store/map-store";

import { ExampleGallery } from "./example-gallery";

/** Not a map: picking it opens the examples gallery. */
const GALLERY = "__galeria__";

export function MapPicker() {
  const mapId = useMapStore((s) => s.mapId);
  const userMaps = useMapStore((s) => s.userMaps);
  const setMap = useMapStore((s) => s.setMap);
  const shared = useMapStore((s) => s.shared);
  const [gallery, setGallery] = useState(false);
  return (
    <>
      <Select value={mapId} onValueChange={(value) => (value === GALLERY ? setGallery(true) : setMap(value))}>
        <SelectTrigger
          size="sm"
          className="w-36 bg-background max-md:data-[size=sm]:h-10 sm:w-44"
          aria-label="Mapa"
          data-testid="map-picker"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {shared && (
            <>
              <SelectGroup>
                <SelectLabel>Compartido (sin guardar)</SelectLabel>
                <SelectItem value={SHARED_ID}>{shared.map.title}</SelectItem>
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          {userMaps.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel>Mis mapas</SelectLabel>
                {userMaps.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.map.title}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel>Ejemplos (solo lectura)</SelectLabel>
            {BUNDLED_MAPS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.map.title}
              </SelectItem>
            ))}
            <SelectItem value={GALLERY} data-testid="open-gallery-from-picker" className="text-muted-foreground">
              Ver todos los ejemplos…
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <ExampleGallery open={gallery} onOpenChange={setGallery} returnFocus={['[data-testid="map-picker"]']} />
    </>
  );
}
