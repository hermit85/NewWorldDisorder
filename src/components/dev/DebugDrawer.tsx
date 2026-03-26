// ═══════════════════════════════════════════════════════════
// Debug Drawer — internal pre-test inspection surface
// Shows: venue state, run state, recent events, sim controls
// Hidden in production. Toggled via 5-tap on tab bar brand.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { colors } from '@/theme/colors';
import {
  getRecentEvents,
  getDebugSummary,
  subscribeDebugEvents,
  clearDebugEvents,
  DebugEvent,
  DebugCategory,
} from '@/systems/debugEvents';
import {
  isTestMode,
  setTestMode,
  getSimOverrides,
  setSimOverrides,
  setFetchOverride,
  resetSimOverrides,
  subscribeTestMode,
  SimulationOverrides,
} from '@/systems/testMode';
import { useVenueContext } from '@/hooks/useVenueContext';
import { useAuthContext } from '@/hooks/AuthContext';

type Tab = 'state' | 'events' | 'sim';

const CATEGORY_COLORS: Record<DebugCategory, string> = {
  venue: '#4CAF50',
  gps: '#2196F3',
  run: '#FF9800',
  save: '#E91E63',
  fetch: '#9C27B0',
  auth: '#00BCD4',
  nav: '#607D8B',
  sim: '#FFEB3B',
  queue: '#FF5722',
  avatar: '#8BC34A',
};

export function DebugDrawer({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('state');
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsub1 = subscribeDebugEvents(() => forceUpdate());
    const unsub2 = subscribeTestMode(() => forceUpdate());
    return () => { unsub1(); unsub2(); };
  }, []);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>NWD DEBUG</Text>
        <View style={s.tabs}>
          {(['state', 'events', 'sim'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'state' ? 'STATE' : t === 'events' ? 'EVENTS' : 'SIM'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeText}>X</Text>
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {tab === 'state' && <StateTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'sim' && <SimTab />}
      </ScrollView>
    </View>
  );
}

// ── STATE TAB ──

function StateTab() {
  const venueCtx = useVenueContext(true);
  const { isAuthenticated, profile, state: authState } = useAuthContext();
  const summary = getDebugSummary();

  const venue = venueCtx.context?.venue;
  const startZone = venueCtx.context?.startZone;

  return (
    <>
      <SectionTitle>AUTH</SectionTitle>
      <Row label="Status" value={authState.status} />
      <Row label="Authenticated" value={isAuthenticated ? 'YES' : 'NO'} color={isAuthenticated ? '#4CAF50' : '#FF5722'} />
      <Row label="User ID" value={profile?.id?.slice(0, 8) ?? '—'} />

      <SectionTitle>VENUE / LOCATION</SectionTitle>
      <Row label="Poll status" value={venueCtx.status} />
      <Row label="Inside venue" value={venue?.isInsideVenue ? 'YES' : 'NO'} color={venue?.isInsideVenue ? '#4CAF50' : '#666'} />
      <Row label="Venue" value={venue?.venueName ?? '—'} />
      <Row label="Dist to venue" value={venue?.distanceToVenueM != null ? `${venue.distanceToVenueM}m` : '—'} />
      <Row label="At start" value={startZone?.isAtStart ? 'YES' : 'NO'} color={startZone?.isAtStart ? '#4CAF50' : '#666'} />
      <Row label="Near start" value={startZone?.isNearStart ? 'YES' : 'NO'} />
      <Row label="Nearest trail" value={startZone?.nearestStart?.trailName ?? '—'} />
      <Row label="Nearest dist" value={startZone?.nearestStart ? `${startZone.nearestStart.distanceM}m` : '—'} />
      <Row label="Ambiguous" value={startZone?.ambiguous ? 'YES' : 'NO'} color={startZone?.ambiguous ? '#FF9800' : '#666'} />
      <Row label="Last update" value={venueCtx.lastUpdate ? new Date(venueCtx.lastUpdate).toLocaleTimeString() : '—'} />

      <SectionTitle>DEBUG SUMMARY</SectionTitle>
      <Row label="Total events" value={String(summary.total)} />
      <Row label="Errors" value={String(summary.errors)} color={summary.errors > 0 ? '#F44336' : '#666'} />
      <Row label="Last error" value={summary.lastError?.name ?? '—'} />
    </>
  );
}

// ── EVENTS TAB ──

function EventsTab() {
  const [filter, setFilter] = useState<DebugCategory | 'all'>('all');
  const events = getRecentEvents(50);
  const filtered = filter === 'all' ? events : events.filter((e) => e.category === filter);

  return (
    <>
      {/* Filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, maxHeight: 32 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            style={[s.filterChip, filter === 'all' && s.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={s.filterChipText}>ALL</Text>
          </Pressable>
          {(Object.keys(CATEGORY_COLORS) as DebugCategory[]).map((cat) => (
            <Pressable
              key={cat}
              style={[s.filterChip, filter === cat && { backgroundColor: CATEGORY_COLORS[cat] + '40', borderColor: CATEGORY_COLORS[cat] }]}
              onPress={() => setFilter(cat)}
            >
              <Text style={[s.filterChipText, { color: CATEGORY_COLORS[cat] }]}>{cat.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable onPress={clearDebugEvents} style={s.clearBtn}>
        <Text style={s.clearBtnText}>CLEAR</Text>
      </Pressable>

      {/* Event list — newest first */}
      {[...filtered].reverse().map((ev) => (
        <EventRow key={ev.id} event={ev} />
      ))}

      {filtered.length === 0 && (
        <Text style={s.emptyText}>No events</Text>
      )}
    </>
  );
}

function EventRow({ event: ev }: { event: DebugEvent }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[ev.category] ?? '#999';
  const statusIcon = ev.status === 'ok' ? '✓' : ev.status === 'fail' ? '✗' : ev.status === 'start' ? '→' : ev.status === 'warn' ? '!' : '·';
  const time = new Date(ev.ts).toLocaleTimeString();

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={s.eventRow}>
      <View style={s.eventHeader}>
        <Text style={[s.eventCat, { color: catColor }]}>{ev.category}</Text>
        <Text style={[s.eventStatus, ev.status === 'fail' && { color: '#F44336' }]}>{statusIcon}</Text>
        <Text style={s.eventName} numberOfLines={1}>{ev.name}</Text>
        <Text style={s.eventTime}>{time}</Text>
      </View>
      {expanded && ev.payload && (
        <Text style={s.eventPayload}>{JSON.stringify(ev.payload, null, 2)}</Text>
      )}
    </Pressable>
  );
}

// ── SIM TAB ──

function SimTab() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const testOn = isTestMode();
  const overrides = getSimOverrides();

  useEffect(() => {
    const unsub = subscribeTestMode(() => forceUpdate());
    return unsub;
  }, []);

  const toggleTestMode = useCallback((val: boolean) => {
    setTestMode(val);
  }, []);

  return (
    <>
      <SectionTitle>TEST MODE</SectionTitle>
      <View style={s.simRow}>
        <Text style={s.simLabel}>Test Mode Active</Text>
        <Switch value={testOn} onValueChange={toggleTestMode} />
      </View>

      {!testOn && (
        <Text style={s.simHint}>Enable test mode to use simulation overrides</Text>
      )}

      {testOn && (
        <>
          <Pressable onPress={resetSimOverrides} style={s.clearBtn}>
            <Text style={s.clearBtnText}>RESET ALL</Text>
          </Pressable>

          <SectionTitle>LOCATION</SectionTitle>
          <SimSelect
            label="Location state"
            value={overrides.locationState}
            options={['real', 'no_location', 'denied', 'weak_gps']}
            onChange={(v) => setSimOverrides({ locationState: v as any })}
          />

          <SectionTitle>VENUE</SectionTitle>
          <SimSelect
            label="Venue state"
            value={overrides.venueState}
            options={['real', 'at_venue', 'at_start_clear', 'at_start_ambiguous', 'near_start', 'outside_venue']}
            onChange={(v) => setSimOverrides({ venueState: v as any })}
          />

          <SectionTitle>RUN</SectionTitle>
          <SimSelect
            label="Tracking behavior"
            value={overrides.trackingBehavior}
            options={['real', 'fail_start', 'delayed_points']}
            onChange={(v) => setSimOverrides({ trackingBehavior: v as any })}
          />

          <SectionTitle>SAVE</SectionTitle>
          <SimSelect
            label="Save behavior"
            value={overrides.saveBehavior}
            options={['real', 'delay_3s', 'fail', 'timeout']}
            onChange={(v) => setSimOverrides({ saveBehavior: v as any })}
          />

          <SectionTitle>FETCH OVERRIDES</SectionTitle>
          {(Object.keys(overrides.fetchOverrides) as (keyof SimulationOverrides['fetchOverrides'])[]).map((key) => (
            <SimSelect
              key={key}
              label={key}
              value={overrides.fetchOverrides[key]}
              options={['real', 'fail', 'empty']}
              onChange={(v) => setFetchOverride(key, v as any)}
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Shared components ──

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function SimSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.simSelectRow}>
      <Text style={s.simSelectLabel}>{label}</Text>
      <View style={s.simSelectOptions}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[s.simOption, value === opt && s.simOptionActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[s.simOptionText, value === opt && s.simOptionTextActive]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#0f0',
    letterSpacing: 3,
    flex: 1,
  },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#444' },
  tabActive: { borderColor: '#0f0', backgroundColor: 'rgba(0, 255, 0, 0.1)' },
  tabText: { fontFamily: 'monospace', fontSize: 10, color: '#888', letterSpacing: 1 },
  tabTextActive: { color: '#0f0' },
  closeBtn: { marginLeft: 12, padding: 8 },
  closeText: { fontFamily: 'monospace', fontSize: 16, color: '#f44' },

  body: { flex: 1 },
  bodyContent: { padding: 12, paddingBottom: 40 },

  // State tab
  sectionTitle: { fontFamily: 'monospace', fontSize: 10, color: '#0f0', letterSpacing: 2, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { fontFamily: 'monospace', fontSize: 11, color: '#888' },
  rowValue: { fontFamily: 'monospace', fontSize: 11, color: '#ddd' },

  // Events tab
  filterChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#444' },
  filterChipActive: { borderColor: '#0f0', backgroundColor: 'rgba(0,255,0,0.1)' },
  filterChipText: { fontFamily: 'monospace', fontSize: 9, color: '#aaa' },
  clearBtn: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#666', borderRadius: 4, marginBottom: 8 },
  clearBtnText: { fontFamily: 'monospace', fontSize: 9, color: '#888' },
  emptyText: { fontFamily: 'monospace', fontSize: 11, color: '#666', textAlign: 'center', marginTop: 20 },

  eventRow: { borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 4 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventCat: { fontFamily: 'monospace', fontSize: 8, width: 40, textTransform: 'uppercase' },
  eventStatus: { fontFamily: 'monospace', fontSize: 12, color: '#aaa', width: 14 },
  eventName: { fontFamily: 'monospace', fontSize: 10, color: '#ddd', flex: 1 },
  eventTime: { fontFamily: 'monospace', fontSize: 9, color: '#666' },
  eventPayload: { fontFamily: 'monospace', fontSize: 9, color: '#888', marginTop: 4, marginLeft: 60, backgroundColor: '#111', padding: 6, borderRadius: 4 },

  // Sim tab
  simRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  simLabel: { fontFamily: 'monospace', fontSize: 12, color: '#ddd' },
  simHint: { fontFamily: 'monospace', fontSize: 10, color: '#666', marginTop: 8, textAlign: 'center' },
  simSelectRow: { marginBottom: 8 },
  simSelectLabel: { fontFamily: 'monospace', fontSize: 10, color: '#888', marginBottom: 4 },
  simSelectOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  simOption: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#444' },
  simOptionActive: { borderColor: '#0f0', backgroundColor: 'rgba(0,255,0,0.15)' },
  simOptionText: { fontFamily: 'monospace', fontSize: 9, color: '#888' },
  simOptionTextActive: { color: '#0f0' },
});
