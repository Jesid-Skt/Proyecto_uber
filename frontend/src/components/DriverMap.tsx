import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker as MapMarker,
  UserLocation,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { getMapBounds, type MapCoordinate } from "./map-geometry";

type Coordinate = MapCoordinate;
type Region = Coordinate & { latitudeDelta: number; longitudeDelta: number };

export default function DriverMap({
  children,
  style,
  region,
  initialRegion,
  showsUserLocation,
  fitCoordinates,
}: PropsWithChildren<{
  style: StyleProp<ViewStyle>;
  region?: Region;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  fitCoordinates?: Coordinate[];
}>) {
  const view = region ?? initialRegion;
  const camera = useRef<CameraRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const bounds = useMemo(
    () => getMapBounds(fitCoordinates ?? []),
    [fitCoordinates],
  );
  const latitude = view?.latitude;
  const longitude = view?.longitude;
  const latitudeDelta = view?.latitudeDelta;
  const longitudeDelta = view?.longitudeDelta;

  useEffect(() => {
    if (!mapLoaded) return;
    if (bounds) {
      camera.current?.fitBounds(bounds, {
        padding: { top: 48, right: 36, bottom: 48, left: 36 },
        duration: 350,
      });
    } else if (
      latitude !== undefined &&
      longitude !== undefined &&
      latitudeDelta !== undefined &&
      longitudeDelta !== undefined
    ) {
      camera.current?.easeTo({
        center: [longitude, latitude],
        zoom: Math.log2(360 / Math.max(longitudeDelta, latitudeDelta)) - 1,
        duration: 250,
      });
    }
  }, [bounds, latitude, latitudeDelta, longitude, longitudeDelta, mapLoaded]);
  useEffect(() => {
    console.log("[DriverMap DEBUG]", {
      region,
      initialRegion,
      fitCoordinates,
      bounds,
      points: fitCoordinates?.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    });
  }, [region, initialRegion, fitCoordinates, bounds]);
  const initialViewState = bounds
    ? { bounds, padding: { top: 48, right: 36, bottom: 48, left: 36 } }
    : view
      ? {
          center: [view.longitude, view.latitude] as [number, number],
          zoom:
            Math.log2(360 / Math.max(view.longitudeDelta, view.latitudeDelta)) -
            1,
        }
      : undefined;

  return (
    <Map
      style={style}
      mapStyle={
        process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
        "https://tiles.openfreemap.org/styles/liberty"
      }
      onDidFinishLoadingMap={() => setMapLoaded(true)}
    >
      <Camera ref={camera} initialViewState={initialViewState} />
      {showsUserLocation ? <UserLocation /> : null}
      {children}
    </Map>
  );
}

export function Marker({
  coordinate,
  title,
  pinColor = "#167d66",
}: {
  coordinate: Coordinate;
  title: string;
  pinColor?: string;
}) {
  return (
    <MapMarker lngLat={[coordinate.longitude, coordinate.latitude]}>
      <View
        accessibilityLabel={title}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 3,
          borderColor: "#ffffff",
          backgroundColor: pinColor,
        }}
      />
    </MapMarker>
  );
}

export function Polyline({
  coordinates,
  strokeWidth,
  strokeColor,
}: {
  coordinates: Coordinate[];
  strokeWidth: number;
  strokeColor: string;
}) {
  const id = useId();
  if (coordinates.length < 2) return null;
  return (
    <GeoJSONSource
      id={id}
      data={{
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates.map((point) => [
            point.longitude,
            point.latitude,
          ]),
        },
      }}
    >
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{ "line-color": strokeColor, "line-width": strokeWidth }}
      />
    </GeoJSONSource>
  );
}
