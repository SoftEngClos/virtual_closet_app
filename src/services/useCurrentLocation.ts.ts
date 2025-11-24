import * as React from "react";
import * as Location from "expo-location";

type Coords = { lat: number; lon: number };

export function useCurrentLocation() {
  const [coords, setCoords] = React.useState<Coords | null>(null);
  const [permission, setPermission] = React.useState<"granted" | "denied" | "undetermined">("undetermined");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(status);
        if (status !== "granted") {
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch (e: any) {
        setError(e?.message || "Location error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reverseGeocode = React.useCallback(async () => {
    if (!coords) return null;
    const r = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lon });
    const first = r?.[0];
    if (!first) return null;
    const city = first.city || first.subregion || first.region || "";
    const country = first.country || "";
    return `${city}${country ? `, ${country}` : ""}`.trim();
  }, [coords]);

  return { coords, permission, loading, error, reverseGeocode };
}
