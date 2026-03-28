"use client";

import { useCallback, useState } from "react";
import { Box } from "@mui/material";
import ChatPanel, { LiveResource } from "./components/ChatPanel";
import MapSection, { ResourcePin } from "./components/MapSection";
import useUserLocation from "./hooks/useUserLocation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Haversine distance in km between two lat/lng points. */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Geocode a single address string via the Maps Geocoding REST API. */
async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(address + " Atlanta GA");
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${MAPS_KEY}`
    );
    const data = await res.json();
    if (data.status === "OK" && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function Home() {
  const { location } = useUserLocation();
  const [mapPins, setMapPins] = useState<ResourcePin[]>([]);

  const handleResourcesCited = useCallback(
    async (names: string[], liveResources: LiveResource[]) => {
      const pins: ResourcePin[] = [];

      // 1 — RAG resources: fetch lat/lng from local DB
      if (names.length) {
        try {
          const res = await fetch(
            `${API_URL}/resources/by-names?names=${encodeURIComponent(names.join(","))}`
          );
          const data = await res.json();
          for (const r of data.resources ?? []) {
            if (r.lat && r.lng) {
              pins.push({
                name: r.name as string,
                lat: Number(r.lat),
                lng: Number(r.lng),
                category: String(r.category ?? ""),
                address: String(r.address ?? ""),
              });
            }
          }
        } catch {
          // ignore
        }
      }

      // 2 — Live resources: geocode each address
      const geocoded = await Promise.all(
        liveResources.map(async (r) => {
          const coords = await geocodeAddress(r.address);
          if (!coords) return null;
          return {
            name: r.name,
            lat: coords.lat,
            lng: coords.lng,
            category: "other",
            address: r.address,
          } as ResourcePin;
        })
      );
      for (const p of geocoded) {
        if (p) pins.push(p);
      }

      // 3 — Sort by distance from user (closest first)
      if (location) {
        pins.sort(
          (a, b) =>
            distanceKm(location.lat, location.lng, a.lat, a.lng) -
            distanceKm(location.lat, location.lng, b.lat, b.lng)
        );
      }

      setMapPins(pins);
    },
    [location]
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        width: "100%",
        bgcolor: "#111318",
        overflow: "hidden",
      }}
    >
      {/* Left — Map */}
      <Box sx={{ width: 380, flexShrink: 0, borderRight: "1px solid #1e2130", height: "100%" }}>
        <MapSection
          userLat={location?.lat ?? null}
          userLng={location?.lng ?? null}
          resources={mapPins}
        />
      </Box>

      {/* Right — Chat */}
      <Box sx={{ flex: 1, minWidth: 0, height: "100%" }}>
        <ChatPanel
          userLat={location?.lat ?? null}
          userLng={location?.lng ?? null}
          onResourcesCited={handleResourcesCited}
        />
      </Box>
    </Box>
  );
}
