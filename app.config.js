/**
 * Dynamic layer over app.json (Expo merges the two: `config` holds app.json).
 *
 * It exists for one reason: app.json cannot read environment variables, and
 * the Google Maps key for Android must never be committed.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY is needed ONLY for a standalone Android build
 * (the EAS "preview" APK). Locally it comes from .env; on EAS it comes from the
 * project's EAS environment variables (eas.json → "environment": "preview").
 * Expo Go ships its own Google Maps key, so the Map tab works in Expo Go with
 * this left blank: config plugins only run during a native build (prebuild /
 * EAS), so this entry has no effect on Expo Go at all.
 */
const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || undefined;

// An EAS Android build without the key would install fine and then show a
// blank grey map. Fail the build early instead.
if (process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android' && !mapsKey) {
  throw new Error(
    'GOOGLE_MAPS_ANDROID_API_KEY is not set for this EAS build. Add it with ' +
      '`eas env:create --environment preview --name GOOGLE_MAPS_ANDROID_API_KEY --visibility secret`.',
  );
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: mapsKey }],
  ],
});
