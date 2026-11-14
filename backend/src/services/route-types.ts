export type TripMetrics = { distanceKm: number; durationMin: number };

export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: { latitude: number; longitude: number }[];
};
