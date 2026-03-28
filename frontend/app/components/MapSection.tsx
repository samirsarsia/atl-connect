"use client";

import { memo, useCallback, useState } from "react";
import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";

export interface ResourcePin {
  name: string;
  lat: number;
  lng: number;
  category: string;
  address?: string;
}

interface MapSectionProps {
  userLat: number | null;
  userLng: number | null;
  resources: ResourcePin[];
  // Width of the chat panel so the recenter button can offset the map center
  chatPanelWidth?: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  food: { bg: "#f97316", border: "#ea580c" },
  housing: { bg: "#8b5cf6", border: "#7c3aed" },
  jobs: { bg: "#22c55e", border: "#16a34a" },
  financial: { bg: "#eab308", border: "#ca8a04" },
  health: { bg: "#ef4444", border: "#dc2626" },
  legal: { bg: "#3b82f6", border: "#2563eb" },
  emergency: { bg: "#f97316", border: "#ea580c" },
  other: { bg: "#60a5fa", border: "#3b82f6" },
};

function getCategoryColor(category: string) {
  const key = Object.keys(CATEGORY_COLORS).find((k) =>
    category.toLowerCase().includes(k)
  );
  return key ? CATEGORY_COLORS[key] : { bg: "#60a5fa", border: "#ffffff" };
}

const ATLANTA_CENTER = { lat: 33.749, lng: -84.388 };

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LEGEND = [
  { label: "Food", color: "#f97316", emoji: "🍎" },
  { label: "Housing", color: "#8b5cf6", emoji: "🏠" },
  { label: "Jobs", color: "#22c55e", emoji: "💼" },
  { label: "Financial", color: "#eab308", emoji: "💰" },
  { label: "Health", color: "#ef4444", emoji: "🏥" },
  { label: "Legal", color: "#3b82f6", emoji: "⚖️" },
];

// Light glass — frosted white
const glass = {
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(16px) saturate(180%)",
  WebkitBackdropFilter: "blur(16px) saturate(180%)",
  border: "1px solid rgba(0,0,0,0.08)",
};

/**
 * Converts a pixel offset (in screen pixels) into a longitude delta at a given
 * zoom level and latitude. Used to shift the map center left so the user's
 * location appears centered in the visible (non-chat) portion of the screen.
 */
function pxToLngDelta(pxOffset: number, zoom: number, lat: number): number {
  // At zoom 0, the whole world (360°) spans 256px. Each zoom level doubles.
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  // 1 degree lng ≈ 111320 * cos(lat) meters
  const metersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  return (pxOffset * metersPerPx) / metersPerDeg;
}

function LocateMeButton({
  lat,
  lng,
  chatPanelWidth,
}: {
  lat: number;
  lng: number;
  chatPanelWidth: number;
}) {
  const map = useMap();

  const handleClick = useCallback(() => {
    if (!map) return;

    const zoom = map.getZoom() ?? 14;

    // Shift the center left by half the chat panel width so the user dot
    // appears horizontally centered in the visible map area (left of chat).
    const lngShift = pxToLngDelta(chatPanelWidth / 2, zoom, lat);
    map.panTo({ lat, lng: lng - lngShift });
    map.setZoom(14);
  }, [map, lat, lng, chatPanelWidth]);

  return (
    <Tooltip title="Center on my location" placement="left">
      <Box
        onClick={handleClick}
        sx={{
          position: "absolute",
          bottom: 16,
          // Stay left of the chat panel — we place it in the visible area
          right: 12,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: "50%",
          ...glass,
          boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.18s ease",
          "&:hover": {
            background: "rgba(37,99,235,0.12)",
            borderColor: "rgba(37,99,235,0.4)",
            boxShadow: "0 4px 20px rgba(37,99,235,0.2)",
          },
          "&:active": { transform: "scale(0.92)" },
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
        </svg>
      </Box>
    </Tooltip>
  );
}

const MapSection = memo(function MapSection({
  userLat,
  userLng,
  resources,
  chatPanelWidth = 520,
}: MapSectionProps) {
  const center = userLat && userLng ? { lat: userLat, lng: userLng } : ATLANTA_CENTER;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [selectedPin, setSelectedPin] = useState<ResourcePin | null>(null);

  return (
    // No border-radius — map is the full-screen background
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <Box sx={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={12}
            mapId="DEMO_MAP_ID"
            disableDefaultUI
            gestureHandling="greedy"
            style={{ width: "100%", height: "100%" }}
            onClick={() => setSelectedPin(null)}
          >
            {/* User location dot */}
            {userLat && userLng && (
              <AdvancedMarker position={{ lat: userLat, lng: userLng }} title="Your location">
                <Box sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  bgcolor: "#2563eb",
                  border: "3px solid white",
                  boxShadow: "0 0 0 4px rgba(37,99,235,0.30)",
                  animation: "userPulse 2s infinite",
                  "@keyframes userPulse": {
                    "0%, 100%": { boxShadow: "0 0 0 4px rgba(37,99,235,0.30)" },
                    "50%": { boxShadow: "0 0 0 8px rgba(37,99,235,0.10)" },
                  },
                }} />
              </AdvancedMarker>
            )}

            {/* Resource pins */}
            {resources.map((r, i) => {
              const col = getCategoryColor(r.category);
              const dist = userLat && userLng ? distanceMiles(userLat, userLng, r.lat, r.lng) : null;
              const distLabel = dist !== null ? (dist < 0.1 ? "< 0.1 mi" : `${dist.toFixed(1)} mi`) : null;
              return (
                <AdvancedMarker
                  key={i}
                  position={{ lat: r.lat, lng: r.lng }}
                  title={r.name}
                  onClick={() => setSelectedPin(r)}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                    <Pin background={col.bg} borderColor={col.border} glyphColor="white" />
                    {distLabel && (
                      <Box sx={{
                        ...glass,
                        color: "#1e293b",
                        fontSize: 10,
                        fontWeight: 700,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: "20px",
                        whiteSpace: "nowrap",
                        boxShadow: "0 1px 6px rgba(0,0,0,0.10)",
                      }}>
                        {distLabel}
                      </Box>
                    )}
                  </Box>
                </AdvancedMarker>
              );
            })}

            {/* Info popup */}
            {selectedPin && (
              <InfoWindow
                position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
                onCloseClick={() => setSelectedPin(null)}
                pixelOffset={[0, -50]}
              >
                <Box sx={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(0,0,0,0.09)",
                  borderRadius: "14px",
                  p: 1.75,
                  minWidth: 188,
                  maxWidth: 248,
                  position: "relative",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                }}>
                  <IconButton
                    size="small"
                    onClick={() => setSelectedPin(null)}
                    sx={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      color: "#94a3b8",
                      p: 0.25,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      "&:hover": { color: "#0f172a", bgcolor: "rgba(0,0,0,0.06)" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>

                  {selectedPin.category && selectedPin.category !== "other" && (
                    <Box sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      px: 1,
                      py: 0.3,
                      borderRadius: "20px",
                      bgcolor: getCategoryColor(selectedPin.category).bg + "18",
                      border: `1px solid ${getCategoryColor(selectedPin.category).bg}44`,
                      mb: 0.875,
                    }}>
                      <Typography fontSize={10} fontWeight={700} sx={{ color: getCategoryColor(selectedPin.category).bg, textTransform: "capitalize" }}>
                        {selectedPin.category}
                      </Typography>
                    </Box>
                  )}

                  <Typography fontWeight={700} fontSize={13.5} color="#0f172a" pr={2.5} lineHeight={1.35}>
                    {selectedPin.name}
                  </Typography>

                  {selectedPin.address && (
                    <Typography fontSize={11.5} color="#475569" mt={0.625} sx={{ wordBreak: "break-word", lineHeight: 1.4 }}>
                      📍 {selectedPin.address}
                    </Typography>
                  )}

                  {userLat && userLng && (() => {
                    const d = distanceMiles(userLat, userLng, selectedPin.lat, selectedPin.lng);
                    return (
                      <Typography fontSize={11} color="#2563eb" mt={0.5} fontWeight={700}>
                        {d < 0.1 ? "Less than 0.1 mi away" : `${d.toFixed(1)} mi away`}
                      </Typography>
                    );
                  })()}

                  <Box
                    component="a"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      (selectedPin.address ?? selectedPin.name) + " Atlanta GA"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      mt: 1.25,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: "20px",
                      bgcolor: "rgba(5,150,105,0.09)",
                      border: "1px solid rgba(5,150,105,0.25)",
                      fontSize: 11,
                      color: "#059669",
                      textDecoration: "none",
                      fontWeight: 600,
                      transition: "all 0.15s",
                      "&:hover": { bgcolor: "rgba(5,150,105,0.16)", textDecoration: "none" },
                    }}
                  >
                    Open in Maps →
                  </Box>
                </Box>
              </InfoWindow>
            )}

            {/* Locate-me — passes chat width so it can offset the center */}
            {userLat && userLng && (
              <LocateMeButton lat={userLat} lng={userLng} chatPanelWidth={chatPanelWidth} />
            )}
          </Map>
        </APIProvider>

        {/* ── Floating header pill (top-left) ── */}
        <Box sx={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.875,
          borderRadius: "99px",
          ...glass,
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        }}>
          <Box sx={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: "50%", bgcolor: "#16a34a",
              position: "absolute",
              animation: "livePing 2s ease-out infinite",
              "@keyframes livePing": {
                "0%": { transform: "scale(1)", opacity: 0.7 },
                "100%": { transform: "scale(2.4)", opacity: 0 },
              },
            }} />
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#16a34a", position: "absolute" }} />
          </Box>
          <Typography fontWeight={700} fontSize={12} color="#0f172a" lineHeight={1}>
            Nearby Resources
          </Typography>
          <Typography fontSize={11} color="#64748b" lineHeight={1}>
            {userLat ? "· near you" : "· Atlanta"}
          </Typography>
        </Box>

        {/* ── Floating legend (bottom-left) — single row pill ── */}
        <Box sx={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          flexWrap: "nowrap",
          gap: 0.75,
          maxWidth: "min(320px, calc(50vw - 40px))",
          px: 1,
          py: 0.75,
          borderRadius: "99px",
          ...glass,
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        }}>
          {LEGEND.map((item) => (
            <Tooltip key={item.label} title={item.label} placement="top">
              <Box sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                ...glass,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                boxShadow: `0 0 0 2px ${item.color}44`,
                cursor: "default",
                transition: "transform 0.15s, box-shadow 0.15s",
                "&:hover": {
                  transform: "scale(1.15)",
                  boxShadow: `0 0 0 2.5px ${item.color}99`,
                },
              }}>
                {item.emoji}
              </Box>
            </Tooltip>
          ))}

          <Tooltip title="Your location" placement="top">
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              ...glass,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px rgba(37,99,235,0.45)",
              cursor: "default",
              transition: "transform 0.15s",
              "&:hover": { transform: "scale(1.15)" },
            }}>
              <Box sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: "#2563eb",
                border: "2.5px solid white",
                boxShadow: "0 0 0 3px rgba(37,99,235,0.25)",
              }} />
            </Box>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
});

export default MapSection;
