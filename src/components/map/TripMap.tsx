/**
 * The field-trip route map (native, Run 6): numbered stop pins and the
 * route drawn as a straight-line Polyline in trip order. Each marker
 * re-renders its bitmap only briefly (see DestinationMap.tsx), then freezes.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { regionForCoordinates } from '@/lib/mapRegion';
import { layout, motion } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';

import { TripPin } from './TripPin';
import type { TripMapProps } from './types';

export function TripMap({ stops, start, label }: TripMapProps) {
  const { colors, mapStyle, scheme } = useAppTheme();
  const mapRef = useRef<MapView | null>(null);
  const [ready, setReady] = useState(false);
  const points = [...(start ? [start] : []), ...stops.map(({ latitude, longitude }) => ({ latitude, longitude }))];
  const shape = points.map((point) => `${point.latitude},${point.longitude}`).join(';');

  // Re-frame whenever the route changes (order, stops, start).
  useEffect(() => {
    if (!ready || points.length === 0) return;
    mapRef.current?.animateToRegion(regionForCoordinates(points), motion.camera);
    // `shape` captures every change of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shape]);

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={label}>
      <MapView
        ref={(instance) => {
          mapRef.current = instance;
        }}
        style={StyleSheet.absoluteFill}
        onMapReady={() => setReady(true)}
        initialRegion={regionForCoordinates(points)}
        customMapStyle={mapStyle}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}>
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={layout.routeStroke} />
        ) : null}
        {start ? <FrozenMarker key={`start-${scheme}`} coordinate={start} start /> : null}
        {stops.map((stop, index) => (
          <FrozenMarker
            key={`${stop.id}-${index}-${scheme}`}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            number={index + 1}
            title={stop.name}
          />
        ))}
      </MapView>
    </View>
  );
}

function FrozenMarker({
  coordinate,
  number,
  start = false,
  title,
}: {
  coordinate: { latitude: number; longitude: number };
  number?: number;
  start?: boolean;
  title?: string;
}) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), motion.markerSettle);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracking} title={title} zIndex={start ? 1 : 2}>
      <TripPin number={number} start={start} />
    </Marker>
  );
}
