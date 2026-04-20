// ═══════════════════════════════════════════════════════════
// /run/review — post-recording review-before-claim.
// Mounts after the recording screen replaces us with the persisted
// buffer. Renders stats + SVG geometry preview + client-side
// validation. Primary CTA fires finalize_pioneer_run; secondary
// returns the trail to draft so the rider can try again.
// Chunk 5 scope — result screen is Chunk 6.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline } from 'react-native-svg';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography, hudShadows } from '@/theme/gameHud';
import {
  buildTrailGeometry,
  validateGeometry,
  type BufferedPoint,
} from '@/features/recording/geometryBuilder';
import * as recordingStore from '@/features/recording/recordingStore';
import * as api from '@/lib/api';
import type { PioneerGeometry, PioneerRunPayload } from '@/lib/api';
import { useTrail } from '@/hooks/useBackend';
import {
  tapMedium, tapLight, notifySuccess, notifyWarning,
} from '@/systems/haptics';

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  hudColors.terrainHigh,
  hudColors.terrainMid,
  hudColors.terrainDark,
];

const SVG_W = 300;
const SVG_H = 150;
const SVG_PAD = 12;

// ── Helpers ───────────────────────────────────────────────

const INVALID_TIME_PLACEHOLDER = '—:—.—';
/** Minimum points to render the review screen at all. Below this the
 *  geometry would be nonsense (timer could go negative, polyline is a
 *  single dot). 30 is the Pioneer-submission threshold — separate. */
const MIN_POINTS_FOR_REVIEW = 5;

function formatTimer(ms: number): string {
  // Guard against 0-point buffers (durationS can be 0 → fine) and
  // clock-skew / race cases that previously rendered "-1:-1.-8".
  if (!Number.isFinite(ms) || ms < 0) return INVALID_TIME_PLACEHOLDER;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function formatDescent(m: number): string {
  return `${Math.round(m)} m`;
}

/** Project lat/lng points into the SVG viewport. North-up (lat increases → y decreases). */
function buildPolylinePoints(points: BufferedPoint[]): string {
  if (points.length < 2) return '';

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const latSpan = Math.max(maxLat - minLat, 1e-9);
  const lngSpan = Math.max(maxLng - minLng, 1e-9);

  // Fit-scale to viewport with padding; preserve aspect ratio.
  const usableW = SVG_W - SVG_PAD * 2;
  const usableH = SVG_H - SVG_PAD * 2;
  const scale = Math.min(usableW / lngSpan, usableH / latSpan);

  // Centre the projected bbox inside the viewport.
  const offsetX = SVG_PAD + (usableW - lngSpan * scale) / 2;
  const offsetY = SVG_PAD + (usableH - latSpan * scale) / 2;

  return points
    .map((p) => {
      const x = offsetX + (p.lng - minLng) * scale;
      // Flip y so north is up.
      const y = offsetY + (maxLat - p.lat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ── Screen states ─────────────────────────────────────────

type ViewState =
  | { kind: 'loading' }
  | { kind: 'no_buffer' }
  | { kind: 'invalid_too_few'; count: number }
  | { kind: 'ready' }
  | { kind: 'submitting' };

// ═══════════════════════════════════════════════════════════

export default function ReviewScreen() {
  const { trailId: rawTrailId, spotId: rawSpotId } = useLocalSearchParams<{
    trailId?: string;
    spotId?: string;
  }>();
  const trailId = rawTrailId ?? '';
  const spotId = rawSpotId ?? '';
  const router = useRouter();
  const { trail } = useTrail(trailId || null);

  const [viewState, setViewState] = useState<ViewState>({ kind: 'loading' });
  const [points, setPoints] = useState<BufferedPoint[]>([]);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  // ── Load buffer on mount (with one retry for race when STOP
  //    fires before the recording screen's saveBuffer completes).
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const persisted = await recordingStore.restoreBuffer();
        if (cancelled) return;

        if (persisted && persisted.trailId === trailId && persisted.points.length > 0) {
          setPoints(persisted.points);
          setStartedAt(persisted.startedAt);
          // Buffer present but too short to render anything useful —
          // intercept before the rest of the screen mounts so we don't
          // flash nonsense stats (negative time, empty polyline).
          if (persisted.points.length < MIN_POINTS_FOR_REVIEW) {
            setViewState({ kind: 'invalid_too_few', count: persisted.points.length });
          } else {
            setViewState({ kind: 'ready' });
          }
          return;
        }

        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (!cancelled) setViewState({ kind: 'no_buffer' });
    };

    void load();
    return () => { cancelled = true; };
  }, [trailId]);

  // ── Auto-bounce if buffer missing ──────────────────────
  useEffect(() => {
    if (viewState.kind !== 'no_buffer') return;
    const t = setTimeout(() => {
      if (trailId) router.replace(`/trail/${trailId}`);
      else router.back();
    }, 800);
    return () => clearTimeout(t);
  }, [viewState.kind, trailId, router]);

  // ── Invalid recording (< MIN_POINTS_FOR_REVIEW) → alert + redirect.
  //    Kept here (not as an in-body early return) so hook order stays
  //    stable across renders.
  useEffect(() => {
    if (viewState.kind !== 'invalid_too_few') return;
    void recordingStore.clearBuffer();
    Alert.alert(
      'Nagranie nieważne',
      `Zebrano tylko ${viewState.count} ${viewState.count === 1 ? 'punkt' : 'punkty'} GPS. ` +
      `Minimum ${MIN_POINTS_FOR_REVIEW} aby zobaczyć podgląd, minimum 30 aby zatwierdzić ` +
      'jako Pioniera. Zjedź ponownie w aktywnym sygnale GPS.',
      [
        {
          text: 'Wróć do trasy',
          onPress: () => {
            if (trailId) router.replace(`/trail/${trailId}`);
            else router.back();
          },
        },
      ],
    );
  }, [viewState, trailId, router]);

  // ── Derived geometry + validation ──────────────────────
  const geometry = useMemo<PioneerGeometry | null>(() => {
    if (viewState.kind !== 'ready' && viewState.kind !== 'submitting') return null;
    if (points.length === 0) return null;
    return buildTrailGeometry({ points, pioneerRunId: null });
  }, [points, viewState.kind]);

  const validationError = useMemo(() => {
    if (!geometry) return null;
    return validateGeometry(geometry);
  }, [geometry]);

  const polylinePoints = useMemo(() => buildPolylinePoints(points), [points]);

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    if (!geometry || validationError !== null) return;
    if (!trailId || !spotId) return;

    submittedRef.current = true;
    tapMedium();
    setViewState({ kind: 'submitting' });
    setSubmitError(null);

    const durationMs = Math.round(geometry.meta.durationS * 1000);
    const finishedAt = startedAt + durationMs;
    const median = geometry.meta.medianAccuracyM;
    const verification_status = median > 20 ? 'weak_signal' : 'verified';
    const quality_tier: 'perfect' | 'valid' | 'rough' =
      median <= 5 ? 'perfect' :
      median <= 15 ? 'valid' : 'rough';

    const runPayload: PioneerRunPayload = {
      spot_id: spotId,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: durationMs,
      mode: 'ranked',
      verification_status,
      median_accuracy_m: median,
      quality_tier,
    };

    const result = await api.finalizePioneerRun({
      trailId,
      runPayload,
      geometry,
    });

    if (result.ok) {
      notifySuccess();
      await recordingStore.clearBuffer();
      router.replace(`/run/result?runId=${result.data.runId}&isPioneer=true`);
      return;
    }

    // Reset submit guard so retry is possible for recoverable errors.
    submittedRef.current = false;
    notifyWarning();

    if (result.code === 'weak_signal_pioneer') {
      router.replace(`/run/rejected?trailId=${trailId}&spotId=${spotId}&reason=weak_signal`);
      return;
    }

    if (result.code === 'already_pioneered') {
      Alert.alert(
        'Ktoś cię wyprzedził',
        result.message ?? 'Inny rider zakończył nagrywanie przed tobą. Zjedź jeszcze raz — będziesz #2.',
        [{
          text: 'OK',
          onPress: async () => {
            await recordingStore.clearBuffer();
            if (trailId) router.replace(`/trail/${trailId}`);
            else router.back();
          },
        }],
      );
      setViewState({ kind: 'ready' });
      return;
    }

    if (result.code === 'invalid_geometry') {
      Alert.alert(
        'Zbyt krótkie nagranie',
        result.message ?? 'Zjedź dłużej i spróbuj ponownie.',
      );
      setViewState({ kind: 'ready' });
      return;
    }

    // Generic fallback — keep rider on review so they can retry or reject.
    setSubmitError(result.message ?? 'Nie udało się zapisać zjazdu');
    setViewState({ kind: 'ready' });
  }, [geometry, validationError, trailId, spotId, startedAt, router]);

  // ── Reject ─────────────────────────────────────────────
  const handleReject = useCallback(() => {
    tapLight();
    Alert.alert(
      'Odrzucić nagranie?',
      'Trasa zostanie, ale ten zjazd nie zostanie zapisany.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Odrzuć',
          style: 'destructive',
          onPress: async () => {
            await recordingStore.clearBuffer();
            if (trailId) router.replace(`/trail/${trailId}`);
            else router.back();
          },
        },
      ],
    );
  }, [router, trailId]);

  // ── Render ─────────────────────────────────────────────

  if (viewState.kind === 'loading') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.centered}>
            <ActivityIndicator color={hudColors.gpsStrong} />
            <Text style={styles.loadingLabel}>ODCZYT NAGRANIA…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (viewState.kind === 'no_buffer') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.centered}>
            <Text style={styles.noBufferTitle}>BRAK NAGRANIA</Text>
            <Text style={styles.noBufferBody}>
              Nie znaleziono aktywnego zjazdu. Wracam do trasy…
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // invalid_too_few: show a minimal placeholder while the Alert is up.
  // Alert.onPress handles the redirect.
  if (viewState.kind === 'invalid_too_few') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe}>
          <View style={styles.centered}>
            <Text style={styles.noBufferTitle}>NAGRANIE NIEWAŻNE</Text>
            <Text style={styles.noBufferBody}>
              {viewState.count} {viewState.count === 1 ? 'punkt' : 'punkty'} GPS — za mało.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // viewState === 'ready' | 'submitting'
  const isSubmitting = viewState.kind === 'submitting';
  const canSubmit = geometry !== null && validationError === null && !isSubmitting;

  const durationMs = geometry ? Math.round(geometry.meta.durationS * 1000) : 0;
  const distanceM = geometry ? geometry.meta.totalDistanceM : 0;
  const descentM = geometry ? geometry.meta.totalDescentM : 0;
  const median = geometry ? geometry.meta.medianAccuracyM : 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.eyebrow}>⟣ GOTOWY DO ZATWIERDZENIA</Text>
          <Text style={styles.trailTitle}>{trail?.name ?? 'TRASA'}</Text>

          {/* STATS — big HUD numbers */}
          <View style={[styles.timerBox, hudShadows.glowTimer]}>
            <Text style={styles.timerLabel}>CZAS</Text>
            <Text style={styles.timerText}>{formatTimer(durationMs)}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatCell label="DYSTANS" value={formatDistance(distanceM)} />
            <StatCell label="SPADEK" value={formatDescent(descentM)} />
          </View>
          <View style={styles.statsRow}>
            <StatCell label="PUNKTY GPS" value={String(points.length)} />
            <StatCell
              label="ŚREDNIA"
              value={`±${median.toFixed(1)} m`}
              color={median > 20 ? hudColors.gpsWeak : median > 10 ? hudColors.gpsMedium : hudColors.gpsStrong}
            />
          </View>

          {/* SVG GEOMETRY PREVIEW */}
          <View style={styles.svgFrame}>
            <Text style={styles.svgLabel}>TOR · PODGLĄD</Text>
            {points.length < 2 ? (
              <View style={[styles.polylineEmpty, { width: SVG_W, height: SVG_H }]}>
                <Text style={styles.polylineEmptyText}>
                  Za mało punktów aby narysować tor
                </Text>
              </View>
            ) : (
              <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
                <Polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={hudColors.gpsStrong}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>

          {/* VALIDATION WARNINGS */}
          {validationError === 'too_few_points' && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerText}>
                ⚠ Za mało punktów GPS ({points.length}/30). Nie można zatwierdzić jako Pioniera — zjedź ponownie w lepszym sygnale.
              </Text>
            </View>
          )}
          {validationError === 'weak_signal' && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerText}>
                ⚠ Słaby sygnał — kalibracja może być niewiarygodna.
              </Text>
            </View>
          )}
          {validationError === 'invalid_monotonic' && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnBannerText}>
                ⚠ Błąd kolejności punktów — spróbuj ponownie.
              </Text>
            </View>
          )}

          {submitError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}
        </ScrollView>

        {/* CTAs */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryCta,
              !canSubmit && styles.primaryCtaDisabled,
              canSubmit && hudShadows.glowGreen,
              pressed && canSubmit && { transform: [{ scale: 0.98 }] },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={hudColors.terrainDark} />
            ) : (
              <Text
                style={[
                  styles.primaryCtaLabel,
                  !canSubmit && styles.primaryCtaLabelDisabled,
                ]}
              >
                ZATWIERDŹ JAKO PIONIER
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleReject}
            disabled={isSubmitting}
            hitSlop={8}
            style={styles.secondaryCta}
          >
            <Text style={styles.secondaryCtaLabel}>ODRZUĆ I ZJEDŹ PONOWNIE</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Stat cell subcomponent ───────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.terrainDark },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

  loadingLabel: {
    ...hudTypography.label,
    color: hudColors.gpsStrong,
    marginTop: spacing.lg,
    letterSpacing: 4,
  },
  noBufferTitle: {
    ...hudTypography.displayLarge,
    fontSize: 28,
    color: hudColors.gpsWeak,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  noBufferBody: {
    color: hudColors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },

  eyebrow: {
    ...hudTypography.label,
    fontSize: 12,
    color: hudColors.gpsStrong,
    letterSpacing: 4,
    marginBottom: spacing.xs,
  },
  trailTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 24,
    color: hudColors.timerPrimary,
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },

  // Timer hero
  timerBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
  },
  timerLabel: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  timerText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 64,
    letterSpacing: 2,
    color: hudColors.timerPrimary,
    fontVariant: ['tabular-nums'] as any,
    textShadowColor: hudColors.gpsStrong,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },

  // Stats grid
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCell: {
    flex: 1,
    backgroundColor: 'rgba(232, 255, 240, 0.04)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.08)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  statLabel: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    color: hudColors.timerPrimary,
    letterSpacing: 1,
  },

  // SVG preview
  svgFrame: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(232, 255, 240, 0.02)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.06)',
  },
  svgLabel: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },

  // Banners
  warnBanner: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: hudColors.actionDangerBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: hudColors.gpsWeak,
  },
  warnBannerText: {
    color: hudColors.gpsWeak,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBanner: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 67, 101, 0.10)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: hudColors.gpsWeak,
  },
  errorBannerText: {
    color: hudColors.gpsWeak,
    fontSize: 13,
  },

  // Footer CTAs
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 255, 240, 0.08)',
  },
  primaryCta: {
    backgroundColor: hudColors.actionPrimary,
    borderRadius: radii.lg,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaDisabled: {
    // Visible gray — not just dimmed green — so the CTA communicates
    // "not valid yet" at a glance, not "pressed state of the success
    // action". Overrides backgroundColor from primaryCta.
    backgroundColor: 'rgba(232, 255, 240, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.12)',
    opacity: 0.6,
  },
  primaryCtaLabelDisabled: {
    color: 'rgba(232, 255, 240, 0.40)',
  },
  polylineEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: 'rgba(232, 255, 240, 0.12)',
    borderRadius: radii.md,
  },
  polylineEmptyText: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    letterSpacing: 2,
    textAlign: 'center',
  },
  primaryCtaLabel: {
    ...hudTypography.action,
    fontSize: 16,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },
  secondaryCta: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  secondaryCtaLabel: {
    ...hudTypography.label,
    color: hudColors.actionDanger,
    fontSize: 11,
    letterSpacing: 2,
  },
});
