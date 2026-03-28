"use client";

import { useEffect, useState } from "react";

export interface UserLocation {
  lat: number;
  lng: number;
}

export default function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        setError("Location unavailable");
        setLoading(false);
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, []); // run once

  return { location, error, loading };
}
