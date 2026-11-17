/**
 * The interactive map (native). On Android in Expo Go this is Google Maps,
 * using Expo Go's own API key — no key of ours is needed. A standalone APK
 * needs GOOGLE_MAPS_ANDROID_API_KEY (see app.config.js).
 *
 * The web build uses DestinationMap.web.tsx instead, because
 * react-native-maps has no web implementation.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapMarker } from 'react-native-maps';

import { CATEGORY_META } from '@/constants/taxonomy';
import { CALABARZON_REGION, focusRegion, regionForCoordinates } from '@/lib/mapRegion';
import { colors, mapStyle, motion } from '@/theme';

import type { DestinationMapProps, MapFocus } from './types';

export function DestinationMap({ pins, onSelect, onOpen, focus, insets }: DestinationMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const markers = useRef(new Map<string, MapMarker>());
  // Android ignores camera moves made before the map has loaded.
  const [isMapReady, setIsMapReady] = useState(false);

  // Camera requests from the screen: frame everything, or fly to one pin and
  // open its callout. Reads the latest pins without re-running on every render.
  const moveCamera = useEffectEvent((request: MapFocus): (() => void) | undefined => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (request.kind === 'all') {
      map.animateToRegion(pins.length > 0 ? regionForCoordinates(pins) : CALABARZON_REGION, motion.camera);
      return undefined;
    }
    const pin = pins.find((candidate) => candidate.id === request.id);
    if (!pin) return undefined;
    map.animateToRegion(focusRegion(pin), motion.camera);
    const timer = setTimeout(() => markers.current.get(pin.id)?.showCallout(), motion.camera);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    if (!focus || !isMapReady) return;
    return moveCamera(focus);
  }, [focus, isMapReady]);

  return (
    <MapView
      ref={(instance) => {
        mapRef.current = instance;
      }}
      style={StyleSheet.absoluteFill}
      onMapReady={() => setIsMapReady(true)}
      initialRegion={pins.length > 0 ? regionForCoordinates(pins) : CALABARZON_REGION}
      customMapStyle={mapStyle}
      mapPadding={{ top: insets.top, bottom: insets.bottom, left: 0, right: 0 }}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      onPress={(event) => {
        // iOS also reports marker taps here; only a tap on the empty map deselects.
        if (event.nativeEvent.action !== 'marker-press') onSelect(null);
      }}
      accessibilityLabel="Map of destinations in CALABARZON">
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          ref={(marker) => {
            if (marker) markers.current.set(pin.id, marker);
            else markers.current.delete(pin.id);
          }}
          identifier={pin.id}
          coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
          title={pin.name}
          description={`${pin.category} · tap for details`}
          pinColor={colors[CATEGORY_META[pin.category].color]}
          tracksViewChanges={false}
          onPress={() => onSelect(pin.id)}
          onCalloutPress={() => onOpen(pin.id)}
        />
      ))}
    </MapView>
  );
}
