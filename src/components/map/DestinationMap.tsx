/**
 * The interactive map (native). On Android in Expo Go this is Google Maps,
 * using Expo Go's own API key — no key of ours is needed. A standalone APK
 * needs GOOGLE_MAPS_ANDROID_API_KEY (see app.config.js).
 *
 * The web build uses DestinationMap.web.tsx instead, because
 * react-native-maps has no web implementation.
 *
 * Performance on low-end phones: every pin is a custom view, which Google
 * Maps turns into a bitmap. A marker re-renders that bitmap only while
 * `tracksViewChanges` is true — so each marker tracks just long enough to
 * draw itself (on mount, when it is (de)selected, or when the theme changes)
 * and is then frozen. At rest, all 26 markers cost nothing per frame.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapMarker } from 'react-native-maps';

import { useI18n } from '@/context/I18nContext';
import { CALABARZON_REGION, focusRegion, regionForCoordinates } from '@/lib/mapRegion';
import { motion } from '@/theme';
import { useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationPin } from '@/types/database';

import { MapPin } from './MapPin';
import type { DestinationMapProps, MapFocus } from './types';

export function DestinationMap({ pins, selectedId, onSelect, onOpen, focus, insets }: DestinationMapProps) {
  const { mapStyle, scheme } = useAppTheme();
  const { t } = useI18n();
  const mapRef = useRef<MapView | null>(null);
  const markers = useRef(new Map<string, MapMarker>());
  // Android ignores camera moves made before the map has loaded.
  const [isMapReady, setIsMapReady] = useState(false);

  // Camera requests from the screen: frame everything, or fly to one pin and
  // open its callout. Always animated (animateToRegion) — never a jump cut.
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
      moveOnMarkerPress={false}
      onPress={(event) => {
        // iOS also reports marker taps here; only a tap on the empty map deselects.
        if (event.nativeEvent.action !== 'marker-press') onSelect(null);
      }}
      accessibilityLabel={t('map.mapA11y')}>
      {pins.map((pin) => (
        <CategoryMarker
          key={pin.id}
          pin={pin}
          selected={pin.id === selectedId}
          scheme={scheme}
          onRegister={(marker) => {
            if (marker) markers.current.set(pin.id, marker);
            else markers.current.delete(pin.id);
          }}
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </MapView>
  );
}

type CategoryMarkerProps = {
  pin: DestinationPin;
  selected: boolean;
  scheme: string;
  onRegister: (marker: MapMarker | null) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

/** One pin. Tracks view changes only briefly after each visual change (see the file header). */
function CategoryMarker({ pin, selected, scheme, onRegister, onSelect, onOpen }: CategoryMarkerProps) {
  const { t, categoryLabel } = useI18n();
  const look = `${selected}:${scheme}`;
  const [tracking, setTracking] = useState(true);
  const [drawnLook, setDrawnLook] = useState(look);

  // A new look (selection or theme) → draw again. Adjusted during render, not in an effect.
  if (drawnLook !== look) {
    setDrawnLook(look);
    setTracking(true);
  }

  // …then freeze the bitmap once the view has had time to draw.
  useEffect(() => {
    if (!tracking) return;
    const timer = setTimeout(() => setTracking(false), motion.markerSettle);
    return () => clearTimeout(timer);
  }, [tracking]);

  const category = categoryLabel(pin.category);
  return (
    <Marker
      ref={onRegister}
      identifier={pin.id}
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      anchor={{ x: 0.5, y: 1 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
      title={pin.name}
      description={t('map.calloutHint', { category })}
      tracksViewChanges={tracking}
      zIndex={selected ? 2 : 1}
      onPress={() => onSelect(pin.id)}
      onCalloutPress={() => onOpen(pin.id)}
      accessibilityLabel={t('map.pinA11y', { name: pin.name, category })}>
      <MapPin category={pin.category} selected={selected} />
    </Marker>
  );
}
