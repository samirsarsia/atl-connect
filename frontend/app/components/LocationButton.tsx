"use client";

import { useMap } from "react-leaflet";
import { IconButton, Paper } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";

interface LocationButtonProps {
    lat: number;
    lng: number;
}

// Add 'export default' here
export default function LocationButton({ lat, lng }: LocationButtonProps) {
    const map = useMap();

    const handleRecenter = () => {
        if (lat && lng) {
            map.flyTo([lat, lng], 15, {
                animate: true,
                duration: 1.5,
            });
        }
    };

    return (
        <Paper
            elevation={3}
            sx={{
                position: "absolute",
                bottom: 24,
                right: 24,
                zIndex: 1000,
                borderRadius: "50%",
                overflow: "hidden", // Ensures the ripple effect stays circular
            }}
        >
            <IconButton
                onClick={handleRecenter}
                color="primary"
                size="large"
                sx={{
                    backgroundColor: "white",
                    "&:hover": { backgroundColor: "#f5f5f5" }
                }}
            >
                <MyLocationIcon />
            </IconButton>
        </Paper>
    );
}