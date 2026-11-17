/**
 * A small, non-interactive map with one pin, for the Details screen.
 * `liteMode` makes Google Maps on Android draw a static bitmap — cheap
 * inside a scroll view. The card around it handles the tap.
 */
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { focusRegion } from '@/lib/mapRegion';
import { mapStyle } from '@/theme';

import type { MapPreviewProps } from './types';

const PREVIEW_DELTA = 0.06;

export function MapPreview({ latitude, longitude, pinColor, label }: MapPreviewProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible accessibilityLabel={label}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={focusRegion({ latitude, longitude }, PREVIEW_DELTA)}
        liteMode
        customMapStyle={mapStyle}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}>
        <Marker coordinate={{ latitude, longitude }} pinColor={pinColor} tracksViewChanges={false} />
      </MapView>
    </View>
  );
}
