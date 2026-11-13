export type MapCoordinate = { latitude: number; longitude: number };
export type MapBounds = [west: number, south: number, east: number, north: number];

export function getMapBounds(coordinates: readonly MapCoordinate[]): MapBounds | null {
  let validCount = 0;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const { latitude, longitude } of coordinates) {
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) continue;
    validCount += 1;
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  if (validCount < 2) return null;

  const minimumSpan = 0.005;
  if (east - west < minimumSpan) {
    const center = (west + east) / 2;
    west = Math.max(-180, center - minimumSpan / 2);
    east = Math.min(180, center + minimumSpan / 2);
  }
  if (north - south < minimumSpan) {
    const center = (south + north) / 2;
    south = Math.max(-90, center - minimumSpan / 2);
    north = Math.min(90, center + minimumSpan / 2);
  }

  return [west, south, east, north];
}
