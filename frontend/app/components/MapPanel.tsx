"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Resource } from "../lib/resources";
import LocationButton from "./LocationButton"
import { CATEGORY_COLORS, Category } from "../lib/resources";

const createResourceIcon = (category: Category) => {
  const { color, emoji } = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

  return L.divIcon({
    className: "custom-resource-pin",
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        <span style="transform: rotate(45deg); font-size: 16px;">${emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32], // Points the bottom tip to the coordinate
  });
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com',
  iconUrl: 'https://cdnjs.cloudflare.com',
  shadowUrl: 'https://cdnjs.cloudflare.com',
});
// Custom blue dot for user location
const userLocationIcon = L.divIcon({
  className: "user-location-pulse",
  html: '<div style="background-color:#2196f3; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
function SnapToLocationOnce({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const hasCentered = useRef(false); // Track if we've already snapped

  useEffect(() => {
    // Only fly to location if we haven't already and coordinates exist
    if (lat && lng && !hasCentered.current) {
      map.flyTo([lat, lng], 14, {
        animate: true,
        duration: 1.5 // Seconds for the smooth "fly" animation
      });
      hasCentered.current = true; // Mark as done so it won't trigger again
    }
  }, [lat, lng, map]);

  return null;
}
interface MapPanelProps {
  resources: Resource[];
  userLocation: { lat: number; lng: number } | null;
}

export default function MapPanel({ resources, userLocation }: MapPanelProps) {
  return (
    <MapContainer
      key={userLocation ? `${userLocation.lat}-${userLocation.lng}` : 'default-map'}
      center={[33.75, -84.39]} // Fallback center (initial load only)
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* When userLocation becomes available, this component triggers the move */}
      {userLocation && (
        <>
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />
          <SnapToLocationOnce lat={userLocation.lat} lng={userLocation.lng} />
          <LocationButton lat={userLocation.lat} lng={userLocation.lng} />
        </>
      )}

      {/* Your other markers */}
      {resources.map((res, index) => (
        <Marker
          key={`${res.name}-${index}`}
          position={[res.lat, res.lng]}
          icon={createResourceIcon(res.category)}
        >
          <Popup>
            <div style={{ padding: '5px' }}>
              <strong>{res.name}</strong><br />
              <small>{res.address}</small><br />
              <p style={{ margin: '8px 0 0' }}>{res.phone}</p>
              <p style={{ fontSize: '11px', color: '#666' }}>{res.hours}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
