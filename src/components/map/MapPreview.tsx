/**
 * A small, non-interactive map with one pin, for the Details screen.
 * `liteMode` makes Google Maps on Android draw a static bitmap — cheap
 * inside a scroll view. The card around it handles the tap.
 */
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { focusRegion } from '@/lib/mapRegion';
import { useAppTheme } from '@/theme/ThemeProvider';

import type { MapPreviewProps } from './types';

const PREVIEW_DELTA = 0.06;

export function MapPreview({ latitude, longitude, pinColor, label }: MapPreviewProps) {
  const { mapStyle, scheme } = useAppTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible accessibilityLabel={label}>
      <MapView
        // Lite mode draws a static bitmap: remount it so a theme switch restyles it.
        key={scheme}
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
