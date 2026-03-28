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
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  food:      { bg: "#f97316", border: "#ea580c" },
  housing:   { bg: "#8b5cf6", border: "#7c3aed" },
  jobs:      { bg: "#22c55e", border: "#16a34a" },
  financial: { bg: "#eab308", border: "#ca8a04" },
  health:    { bg: "#ef4444", border: "#dc2626" },
  legal:     { bg: "#3b82f6", border: "#2563eb" },
  emergency: { bg: "#f97316", border: "#ea580c" },
  other:     { bg: "#60a5fa", border: "#3b82f6" },
};

function getCategoryColor(category: string) {
  const key = Object.keys(CATEGORY_COLORS).find((k) =>
    category.toLowerCase().includes(k)
  );
  return key ? CATEGORY_COLORS[key] : { bg: "#60a5fa", border: "#3b82f6" };
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
  { label: "Food",      color: "#f97316" },
  { label: "Housing",   color: "#8b5cf6" },
  { label: "Jobs",      color: "#22c55e" },
  { label: "Financial", color: "#eab308" },
  { label: "Health",    color: "#ef4444" },
  { label: "Legal",     color: "#3b82f6" },
];

function LocateMeButton({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const handleClick = useCallback(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    map.setZoom(15);
  }, [map, lat, lng]);

  return (
    <Tooltip title="Go to my location" placement="left">
      <Box
        onClick={handleClick}
        sx={{
          position: "absolute",
          bottom: 16,
          right: 12,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: "#111318",
          border: "1.5px solid #2a2d3a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          transition: "background 0.15s, border-color 0.15s",
          "&:hover": { bgcolor: "#1e2130", borderColor: "#3b82f6" },
          "&:active": { transform: "scale(0.94)" },
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
        </svg>
      </Box>
    </Tooltip>
  );
}

const MapSection = memo(function MapSection({ userLat, userLng, resources }: MapSectionProps) {
  const center = userLat && userLng ? { lat: userLat, lng: userLng } : ATLANTA_CENTER;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const [selectedPin, setSelectedPin] = useState<ResourcePin | null>(null);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#111318" }}>

      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: "1px solid #1e2130", flexShrink: 0 }}>
        <Typography fontWeight={700} fontSize={14} color="#e4e4e7">
          Nearby Resources
        </Typography>
        <Typography fontSize={11} color="#52525b" mt={0.25}>
          {userLat ? "Showing resources near you" : "Atlanta area · enable location for nearby results"}
        </Typography>
      </Box>

      {/* Map */}
      <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
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
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    bgcolor: "#3b82f6",
                    border: "3px solid white",
                    boxShadow: "0 0 0 4px rgba(59,130,246,0.35)",
                    animation: "userPulse 2s infinite",
                    "@keyframes userPulse": {
                      "0%, 100%": { boxShadow: "0 0 0 4px rgba(59,130,246,0.35)" },
                      "50%":       { boxShadow: "0 0 0 8px rgba(59,130,246,0.1)" },
                    },
                  }}
                />
              </AdvancedMarker>
            )}

            {/* Resource pins */}
            {resources.map((r, i) => {
              const col = getCategoryColor(r.category);
              const dist =
                userLat && userLng ? distanceMiles(userLat, userLng, r.lat, r.lng) : null;
              const distLabel =
                dist !== null ? (dist < 0.1 ? "< 0.1 mi" : `${dist.toFixed(1)} mi`) : null;
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
                      <Box
                        sx={{
                          bgcolor: "rgba(17,19,24,0.85)",
                          color: "#e4e4e7",
                          fontSize: 10,
                          fontWeight: 600,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                          border: "1px solid #2a2d3a",
                        }}
                      >
                        {distLabel}
                      </Box>
                    )}
                  </Box>
                </AdvancedMarker>
              );
            })}

            {/* Info popup when a pin is selected */}
            {selectedPin && (
              <InfoWindow
                position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
                onCloseClick={() => setSelectedPin(null)}
                pixelOffset={[0, -50]}
              >
                <Box
                  sx={{
                    bgcolor: "#1a1c24",
                    borderRadius: "10px",
                    p: 1.5,
                    minWidth: 180,
                    maxWidth: 240,
                    position: "relative",
                  }}
                >
                  {/* Close button */}
                  <IconButton
                    size="small"
                    onClick={() => setSelectedPin(null)}
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      color: "#71717a",
                      p: 0.25,
                      "&:hover": { color: "#e4e4e7" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>

                  {/* Category chip */}
                  {selectedPin.category && selectedPin.category !== "other" && (
                    <Box
                      sx={{
                        display: "inline-block",
                        px: 0.75,
                        py: 0.15,
                        borderRadius: "6px",
                        bgcolor: getCategoryColor(selectedPin.category).bg + "22",
                        border: `1px solid ${getCategoryColor(selectedPin.category).bg}55`,
                        mb: 0.75,
                      }}
                    >
                      <Typography
                        fontSize={10}
                        fontWeight={600}
                        sx={{ color: getCategoryColor(selectedPin.category).bg, textTransform: "capitalize" }}
                      >
                        {selectedPin.category}
                      </Typography>
                    </Box>
                  )}

                  {/* Name */}
                  <Typography fontWeight={700} fontSize={13} color="#e4e4e7" pr={2} lineHeight={1.3}>
                    {selectedPin.name}
                  </Typography>

                  {/* Address */}
                  {selectedPin.address && (
                    <Typography
                      fontSize={11}
                      color="#94a3b8"
                      mt={0.5}
                      sx={{ wordBreak: "break-word" }}
                    >
                      📍 {selectedPin.address}
                    </Typography>
                  )}

                  {/* Distance */}
                  {userLat && userLng && (() => {
                    const d = distanceMiles(userLat, userLng, selectedPin.lat, selectedPin.lng);
                    return (
                      <Typography fontSize={11} color="#60a5fa" mt={0.5} fontWeight={600}>
                        {d < 0.1 ? "Less than 0.1 mi away" : `${d.toFixed(1)} mi away`}
                      </Typography>
                    );
                  })()}

                  {/* Maps link */}
                  <Box
                    component="a"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      (selectedPin.address ?? selectedPin.name) + " Atlanta GA"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: "block",
                      mt: 1,
                      fontSize: 11,
                      color: "#34d399",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    Open in Google Maps →
                  </Box>
                </Box>
              </InfoWindow>
            )}

            {/* Locate-me button */}
            {userLat && userLng && <LocateMeButton lat={userLat} lng={userLng} />}
          </Map>
        </APIProvider>
      </Box>

      {/* Legend */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid #1e2130",
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        {LEGEND.map((item) => (
          <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: item.color, flexShrink: 0 }} />
            <Typography fontSize={11} color="#71717a">{item.label}</Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#3b82f6", border: "2px solid white", flexShrink: 0 }} />
          <Typography fontSize={11} color="#71717a">You</Typography>
        </Box>
      </Box>
    </Box>
  );
});

export default MapSection;
