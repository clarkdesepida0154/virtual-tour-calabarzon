/**
 * Dynamic layer over app.json (Expo merges the two: `config` holds app.json).
 *
 * It exists for one reason: app.json cannot read environment variables, and
 * the Google Maps key for Android must come from .env, never from git.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY is needed ONLY for a standalone Android build
 * (the APK planned for Run 4). Expo Go ships its own Google Maps key, so the
 * Map tab works in Expo Go with this left blank. Config plugins only run
 * during a native build (prebuild / EAS), so this entry has no effect on
 * Expo Go at all.
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || undefined,
      },
    ],
  ],
});
