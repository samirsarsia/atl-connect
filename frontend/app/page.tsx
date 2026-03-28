"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Box, Paper, Typography, CircularProgress } from "@mui/material";
import { Resource } from "./lib/resources";
import ChatPanel from "./components/ChatPanel";
import useGeolocation from './components/Location';

const MapPanel = dynamic(() => import("./components/MapPanel"), { ssr: false });

/* ... existing imports ... */

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const { latitude, longitude, error, loading } = useGeolocation();

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", bgcolor: "background.default" }}>
      <Box sx={{ width: "65%", minWidth: 300, display: "flex", flexDirection: "column", borderRight: "1px solid", borderColor: "divider", position: "relative" }}>

        {/* Update this line to pass the location props */}
        <MapPanel
          resources={resources}
          userLocation={latitude && longitude ? { lat: latitude, lng: longitude } : null}
        />

        {/* ... Geolocation Overlay Paper remains the same ... */}
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ChatPanel onResourcesChange={setResources} />
      </Box>
    </Box>
  );
}
