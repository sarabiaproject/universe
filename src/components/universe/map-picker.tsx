"use client";

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
import { useMapStore } from "@/store/map-store";

export function MapPicker() {
  const mapId = useMapStore((s) => s.mapId);
  const userMaps = useMapStore((s) => s.userMaps);
  const setMap = useMapStore((s) => s.setMap);
  return (
    <Select value={mapId} onValueChange={setMap}>
      <SelectTrigger
        size="sm"
        className="w-36 bg-background max-md:data-[size=sm]:h-10 sm:w-44"
        aria-label="Mapa"
        data-testid="map-picker"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
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
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
