import { useState, useEffect, useRef } from 'react';

// Define the shape of our hook's return value
interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
    loading: boolean;
}

const useGeolocation = (options: PositionOptions = {}) => {
    const [state, setState] = useState<GeolocationState>({
        latitude: null,
        longitude: null,
        error: null,
        loading: true,
    });

    // Store the watch ID to clear it if the component unmounts
    const watchId = useRef<number | null>(null);

    useEffect(() => {
        // 1. Check if the browser supports Geolocation
        if (!navigator.geolocation) {
            setState(prev => ({
                ...prev,
                error: "Geolocation is not supported by your browser",
                loading: false
            }));
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setState({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                error: null,
                loading: false,
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            setState(prev => ({
                ...prev,
                error: error.message,
                loading: false
            }));
        };

        // 2. Start watching position for real-time updates
        // Use getCurrentPosition instead if you only want a one-time fix
        watchId.current = navigator.geolocation.watchPosition(
            handleSuccess,
            handleError,
            {
                enableHighAccuracy: true, // Use GPS if available
                timeout: 10000,           // Wait 10s before failing
                maximumAge: 0,            // Don't use cached location
                ...options
            }
        );

        // 3. Cleanup: Clear the watch when component unmounts
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, [options]);

    return state;
};

export default useGeolocation;