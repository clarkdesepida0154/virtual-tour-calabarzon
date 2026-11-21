/**
 * Field Trip Planner (Run 6) — from the Map header and a Home card.
 *
 *   Select (searchable list, max 8 stops, optional "start from my location")
 *     → Plan (suggested nearest-neighbour order, manual up/down reorder,
 *             per-leg + total straight-line distance, a rough time estimate,
 *             the route on an embedded map with numbered pins)
 *     → "Open in Google Maps" (origin, waypoints, destination).
 *
 * Plans are saved / loaded / deleted on the phone (AsyncStorage, no table).
 * Everything works offline except the Google Maps hand-off, which hides
 * behind a short note while offline. Ordering, distances and the URL are
 * pure functions in src/lib/planner.ts (unit-tested).
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Dialog, Portal, Switch, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CoverImage } from '@/components/CoverImage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { SectionHeader } from '@/components/SectionHeader';
import { DestinationCardSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { TripMap } from '@/components/map/TripMap';
import { useI18n } from '@/context/I18nContext';
import { useUserLocation } from '@/context/LocationContext';
import { useToast } from '@/context/ToastContext';
import { useDestinations } from '@/hooks/useDestinations';
import { useShowingSavedData } from '@/lib/appCache';
import { tripPlans } from '@/lib/appTripPlans';
import { openExternalUrl, tapFeedback } from '@/lib/device';
import { formatPlace } from '@/lib/format';
import { formatDistanceValue } from '@/lib/geo';
import { hasCoordinates } from '@/lib/mapRegion';
import { filterSummaries } from '@/lib/offlineCache';
import {
  MAX_STOPS,
  buildDirectionsUrl,
  estimateDriveMinutes,
  legsFor,
  moveItem,
  orderNearestNeighbor,
  splitMinutes,
  toggleSelection,
  totalKm,
} from '@/lib/planner';
import type { Stop } from '@/lib/planner';
import type { TripPlan } from '@/lib/tripPlans';
import { MAX_PLAN_NAME } from '@/lib/tripPlans';
import { iconSize, layout, maxFontScale, radius, spacing, typography } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationSummary } from '@/types/database';

type Phase = 'select' | 'plan';

export default function PlannerScreen() {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, date } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const location = useUserLocation();
  const offline = useShowingSavedData();
  const catalogue = useDestinations({});

  const [phase, setPhase] = useState<Phase>('select');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [fromLocation, setFromLocation] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [isSuggested, setIsSuggested] = useState(true);
  const [loadedPlan, setLoadedPlan] = useState<TripPlan | null>(null);
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [saveVisible, setSaveVisible] = useState(false);
  const [planName, setPlanName] = useState('');
  const [toDelete, setToDelete] = useState<TripPlan | null>(null);

  useEffect(() => {
    let alive = true;
    tripPlans.list().then((list) => {
      if (alive) setPlans(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const reloadPlans = async () => setPlans(await tripPlans.list());

  const places = (catalogue.data ?? []).filter((item): item is DestinationSummary & { latitude: number; longitude: number } =>
    hasCoordinates(item),
  );
  const byId = new Map(places.map((place) => [place.id, place]));
  const toStop = (id: string): Stop | null => {
    const place = byId.get(id);
    return place ? { id: place.id, name: place.name, latitude: place.latitude, longitude: place.longitude } : null;
  };
  const start = fromLocation && location.isAvailable ? location.position : null;
  const canStartFromLocation = location.isOffered;

  const selectedStops = selected.map(toStop).filter((stop): stop is Stop => stop !== null);
  const stops = order.map(toStop).filter((stop): stop is Stop => stop !== null);
  const suggestedIds = orderNearestNeighbor(selectedStops, start).map((stop) => stop.id);
  const enoughStops = selectedStops.length >= 2 || (selectedStops.length >= 1 && start !== null);

  const leave = () => {
    if (phase === 'plan') {
      setPhase('select');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/map');
  };

  const toggle = (id: string) => {
    if (!selected.includes(id) && selected.length >= MAX_STOPS) {
      showToast(t('planner.full', { max: MAX_STOPS }));
      return;
    }
    tapFeedback();
    setSelected((current) => toggleSelection(current, id));
  };

  const toggleFromLocation = async (next: boolean) => {
    if (next && location.status !== 'granted') {
      const allowed = await location.requestPermission();
      if (!allowed) return;
    }
    setFromLocation(next);
  };

  const planRoute = () => {
    if (!enoughStops) {
      showToast(t('planner.needMore'));
      return;
    }
    setOrder(suggestedIds);
    setIsSuggested(true);
    setPhase('plan');
  };

  const move = (index: number, delta: -1 | 1) => {
    tapFeedback();
    setOrder((current) => moveItem(current, index, delta));
    setIsSuggested(false);
  };

  const removeStop = (id: string) => {
    tapFeedback();
    setSelected((current) => current.filter((item) => item !== id));
    setOrder((current) => current.filter((item) => item !== id));
    if (order.length <= 1) setPhase('select');
  };

  const openPlan = (plan: TripPlan) => {
    const kept = plan.stopIds.filter((id) => byId.has(id));
    if (kept.length < plan.stopIds.length) showToast(t('planner.missingStops'));
    setSelected(kept);
    setOrder(kept);
    setFromLocation(plan.fromLocation && canStartFromLocation);
    setIsSuggested(false);
    setLoadedPlan(plan);
    setPhase(kept.length > 0 ? 'plan' : 'select');
  };

  const openSave = () => {
    setPlanName(loadedPlan?.name ?? t('planner.defaultName', { date: date(new Date().toISOString()) }));
    setSaveVisible(true);
  };

  const savePlan = async () => {
    const saved = await tripPlans.save({
      id: loadedPlan?.id,
      name: planName.trim() || t('planner.defaultName', { date: date(new Date().toISOString()) }),
      stopIds: order,
      fromLocation,
    });
    setLoadedPlan(saved);
    setSaveVisible(false);
    await reloadPlans();
    showToast(t('planner.saved'));
  };

  const deletePlan = async () => {
    if (!toDelete) return;
    await tripPlans.remove(toDelete.id);
    if (loadedPlan?.id === toDelete.id) setLoadedPlan(null);
    setToDelete(null);
    await reloadPlans();
    showToast(t('planner.deleted'));
  };

  const url = buildDirectionsUrl(stops, start);
  const openInMaps = async () => {
    if (!url) return;
    tapFeedback();
    if (!(await openExternalUrl(url))) showToast(t('planner.openFailed'));
  };

  const legs = legsFor(stops, start);
  const km = totalKm(legs);
  const minutes = estimateDriveMinutes(km);
  const { hours, minutes: rest } = splitMinutes(minutes);
  const timeText =
    hours > 0 && rest > 0
      ? t('planner.hoursMinutes', { hours, minutes: rest })
      : hours > 0
        ? t('planner.hours', { hours })
        : t('planner.minutes', { minutes: rest });
  // "4.2 km" / "850 m" (language-neutral); very short legs read "50 m".
  const distanceText = (value: number) => formatDistanceValue(Math.max(value, 0.05)) ?? '';

  // ---------------------------------------------------------------------------
  // Select phase
  // ---------------------------------------------------------------------------
  if (phase === 'select') {
    const results = filterSummaries(places, { search });
    return (
      <View style={styles.screen}>
        <ThemedStatusBar />
        <FlatList
          data={catalogue.status === 'success' || catalogue.data ? results : []}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + layout.actionBarHeight + spacing.xxl }]}
          ListHeaderComponent={
            <View style={styles.header}>
              <ScreenHeader overline={t('planner.overline')} title={t('planner.title')} onBack={leave} />
              <View style={styles.headerBody}>
                <OfflineBanner />
                {plans.length > 0 ? (
                  <View style={styles.saved}>
                    <SectionHeader inset={false} title={t('planner.savedTitle')} subtitle={t('planner.savedSubtitle')} />
                    {plans.map((plan) => (
                      <View key={plan.id} style={styles.planRow}>
                        <Pressable
                          onPress={() => openPlan(plan)}
                          accessibilityRole="button"
                          accessibilityLabel={t('planner.openPlanA11y', {
                            name: plan.name,
                            stops: t('planner.planStops', { count: plan.stopIds.length }),
                          })}
                          style={({ pressed }) => [styles.planMain, pressed && styles.pressed]}>
                          <AppIcon name="map-marker-path" size="md" color="primary" />
                          <View style={styles.flex}>
                            <AppText variant="subtitle" numberOfLines={1}>
                              {plan.name}
                            </AppText>
                            <AppText variant="caption" color="inkSoft">
                              {t('planner.planStops', { count: plan.stopIds.length })}
                            </AppText>
                          </View>
                        </Pressable>
                        <AppIconButton
                          icon="trash-can-outline"
                          size={iconSize.md}
                          iconColor={colors.error}
                          onPress={() => setToDelete(plan)}
                          accessibilityLabel={t('planner.deletePlanA11y', { name: plan.name })}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.counter} accessibilityLiveRegion="polite">
                  <AppText variant="subtitle">{t('planner.counter', { count: selected.length, max: MAX_STOPS })}</AppText>
                  <AppText variant="caption" color="inkSoft">
                    {t('planner.counterNote', { max: MAX_STOPS })}
                  </AppText>
                </View>

                {canStartFromLocation ? (
                  <View style={styles.switchRow}>
                    <AppIcon name="crosshairs-gps" size="md" color="primary" />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{t('planner.fromLocation')}</AppText>
                      <AppText variant="caption" color="inkSoft">
                        {t('planner.fromLocationNote')}
                      </AppText>
                    </View>
                    <Switch
                      value={fromLocation}
                      onValueChange={(next) => void toggleFromLocation(next)}
                      color={colors.primary}
                      accessibilityLabel={t('planner.fromLocation')}
                    />
                  </View>
                ) : null}

                <SearchField value={search} onChangeText={setSearch} placeholder={t('planner.searchPlaceholder')} />
              </View>
            </View>
          }
          ListEmptyComponent={
            catalogue.status === 'error' && catalogue.error ? (
              <ErrorState error={catalogue.error} onRetry={catalogue.retry} />
            ) : catalogue.status === 'loading' ? (
              <View style={styles.loading} accessibilityLabel={t('planner.loadingA11y')}>
                <DestinationCardSkeleton />
              </View>
            ) : (
              <EmptyState icon="map-search-outline" title={t('planner.noResults')} message="" />
            )
          }
          renderItem={({ item }) => {
            const index = selected.indexOf(item.id);
            const isSelected = index >= 0;
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={t('planner.stopCheckA11y', { name: item.name, place: formatPlace(item) })}
                style={({ pressed }) => [styles.pickRow, isSelected && styles.pickRowSelected, pressed && styles.pressed]}>
                <CoverImage uri={item.cover_image_url} label={t('common.photoOf', { name: item.name })} style={styles.thumb} />
                <View style={styles.flex}>
                  <AppText variant="cardTitleSmall" numberOfLines={2}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" color="inkSoft" numberOfLines={1}>
                    {formatPlace(item)}
                  </AppText>
                  {isSelected ? (
                    <AppText variant="label" color="primary">
                      {t('planner.selectedA11y')}
                    </AppText>
                  ) : null}
                </View>
                <View style={[styles.check, isSelected && styles.checkOn]}>
                  {isSelected ? (
                    <AppText variant="label" color="onPrimary">
                      {index + 1}
                    </AppText>
                  ) : (
                    <AppIcon name="plus" size="sm" color="muted" />
                  )}
                </View>
              </Pressable>
            );
          }}
        />

        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            label={t('planner.planRoute', { count: selected.length })}
            icon="map-marker-path"
            onPress={planRoute}
            disabled={selected.length === 0}
            style={styles.flex}
          />
        </View>

        <ConfirmDialog
          visible={toDelete !== null}
          title={t('planner.deleteDialogTitle')}
          message={toDelete ? t('planner.deleteDialogMessage', { name: toDelete.name }) : ''}
          confirmLabel={t('common.delete')}
          destructive
          onConfirm={() => void deletePlan()}
          onCancel={() => setToDelete(null)}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Plan phase
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.screen}>
      <ThemedStatusBar />
      <ScrollView contentContainerStyle={[styles.planScroll, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader overline={t('planner.overline')} title={loadedPlan?.name ?? t('planner.title')} onBack={leave} />
        <View style={styles.planBody}>
          <View style={styles.mapFrame}>
            <TripMap stops={stops} start={start} label={t('planner.mapA11y', { count: stops.length })} />
          </View>

          <View style={styles.orderHead}>
            <View style={styles.flex}>
              <AppText variant="sectionTitle" accessibilityRole="header">
                {isSuggested ? t('planner.suggested') : t('planner.yourOrder')}
              </AppText>
              {isSuggested ? (
                <AppText variant="caption" color="inkSoft">
                  {start
                    ? t('planner.suggestedFromLocation')
                    : t('planner.suggestedFromFirst', { name: stops[0]?.name ?? '' })}
                </AppText>
              ) : null}
            </View>
            {!isSuggested ? (
              <AppButton
                label={t('planner.resetOrder')}
                icon="sort"
                variant="text"
                onPress={() => {
                  setOrder(orderNearestNeighbor(stops, start).map((stop) => stop.id));
                  setIsSuggested(true);
                }}
              />
            ) : null}
          </View>

          <View style={styles.card}>
            {start ? (
              <View style={styles.stopRow}>
                <View style={[styles.stopNumber, styles.stopStart]}>
                  <AppIcon name="account" size="xs" color="onPrimary" />
                </View>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {t('planner.youAreHere')}
                </AppText>
              </View>
            ) : null}
            {stops.map((stop, index) => {
              const leg = legs.find((entry) => entry.toId === stop.id);
              return (
                <View key={stop.id} style={[styles.stopRow, (index > 0 || start) && styles.divider]}>
                  <View style={styles.stopNumber} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <AppText variant="label" color="onPrimary">
                      {index + 1}
                    </AppText>
                  </View>
                  <View style={styles.flex} accessible accessibilityLabel={t('planner.stopA11y', { index: index + 1, name: stop.name })}>
                    <AppText variant="subtitle" numberOfLines={2}>
                      {stop.name}
                    </AppText>
                    {leg ? (
                      <AppText variant="caption" color="inkSoft">
                        {leg.fromId === null
                          ? t('planner.legFromStart', { distance: distanceText(leg.km) })
                          : t('planner.legFromPrevious', { distance: distanceText(leg.km) })}
                      </AppText>
                    ) : null}
                  </View>
                  <AppIconButton
                    icon="chevron-up"
                    compact
                    size={iconSize.md}
                    iconColor={colors.ink}
                    disabled={index === 0}
                    onPress={() => move(index, -1)}
                    accessibilityLabel={t('planner.moveUp', { name: stop.name })}
                  />
                  <AppIconButton
                    icon="chevron-down"
                    compact
                    size={iconSize.md}
                    iconColor={colors.ink}
                    disabled={index === stops.length - 1}
                    onPress={() => move(index, 1)}
                    accessibilityLabel={t('planner.moveDown', { name: stop.name })}
                  />
                  <AppIconButton
                    icon="close"
                    compact
                    size={iconSize.sm}
                    iconColor={colors.inkSoft}
                    onPress={() => removeStop(stop.id)}
                    accessibilityLabel={t('planner.removeStop', { name: stop.name })}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <AppIcon name="map-marker-distance" size="md" color="secondaryDark" />
              <View style={styles.flex}>
                <AppText variant="subtitle">{t('planner.total', { distance: distanceText(km) })}</AppText>
                <AppText variant="caption" color="inkSoft">
                  {t('planner.totalNote')}
                </AppText>
              </View>
            </View>
            <View style={styles.totalRow}>
              <AppIcon name="clock-outline" size="md" color="secondaryDark" />
              <View style={styles.flex}>
                <AppText variant="subtitle">{t('planner.time', { time: timeText })}</AppText>
                <AppText variant="caption" color="inkSoft">
                  {t('planner.timeNote')}
                </AppText>
              </View>
            </View>
          </View>

          {offline ? (
            <View style={styles.note}>
              <AppIcon name="cloud-off-outline" size="sm" color="inkSoft" />
              <AppText variant="caption" color="inkSoft" style={styles.flex}>
                {t('planner.offlineNote')}
              </AppText>
            </View>
          ) : (
            <AppButton
              label={t('planner.openInMaps')}
              icon="google-maps"
              onPress={() => void openInMaps()}
              disabled={!url}
              accessibilityHint={t('planner.openInMapsHint')}
            />
          )}
          <View style={styles.planActions}>
            <AppButton
              label={loadedPlan ? t('planner.update') : t('planner.save')}
              icon="content-save-outline"
              variant="secondary"
              onPress={openSave}
              style={styles.flex}
            />
            <AppButton label={t('planner.editStops')} icon="pencil-outline" variant="secondary" onPress={() => setPhase('select')} style={styles.flex} />
          </View>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={saveVisible} onDismiss={() => setSaveVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{t('planner.saveDialogTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={t('planner.nameLabel')}
              value={planName}
              onChangeText={(text) => setPlanName(text.slice(0, MAX_PLAN_NAME))}
              accessibilityLabel={t('planner.nameLabel')}
              outlineColor={colors.outlineStrong}
              activeOutlineColor={colors.primary}
              style={styles.input}
              contentStyle={styles.inputContent}
              maxFontSizeMultiplier={maxFontScale}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSaveVisible(false)} textColor={colors.inkSoft} labelStyle={styles.dialogLabel}>
              {t('common.cancel')}
            </Button>
            <Button onPress={() => void savePlan()} textColor={colors.primary} labelStyle={styles.dialogLabel}>
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  list: {
    gap: spacing.sm,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  saved: {
    gap: spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  planMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget + spacing.sm,
  },
  counter: {
    gap: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  loading: {
    paddingHorizontal: spacing.lg,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
  pickRowSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  thumb: {
    width: layout.iconBadge + spacing.md,
    height: layout.iconBadge + spacing.md,
    borderRadius: radius.sm,
  },
  check: {
    width: layout.touchTargetCompact - spacing.md,
    height: layout.touchTargetCompact - spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.outlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
    ...elevation.bar,
  },
  planScroll: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  planBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  mapFrame: {
    height: layout.tripMapHeight,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    ...elevation.card,
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: layout.touchTarget + spacing.sm,
  },
  divider: {
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
  },
  stopNumber: {
    width: layout.tripPin,
    height: layout.tripPin,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopStart: {
    backgroundColor: colors.secondaryDark,
  },
  totals: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
  planActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  dialogTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  dialogLabel: {
    ...typography.button,
  },
  input: {
    backgroundColor: colors.surface,
  },
  inputContent: {
    ...typography.input,
  },
}));
