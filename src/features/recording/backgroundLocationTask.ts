// ═══════════════════════════════════════════════════════════
// backgroundLocationTask — TaskManager definition for
// startLocationUpdatesAsync. TOP-LEVEL side effect by design:
// importing this module registers the task with expo-task-manager,
// which must happen during app init on EVERY launch (including
// headless background launches iOS does to deliver samples while
// the app UI is unmounted).
//
// Root app import lives in app/_layout.tsx. Do NOT import this
// module from inside a component body — the define call would
// run only when that component mounts, missing headless launches.
//
// The handler runs outside React. It cannot setState, cannot call
// hooks. Its only job is to append samples to AsyncStorage via
// recordingStore.appendSamples; the recording screen's 500ms UI
// tick drains that store for display. On error we log to a
// dedicated AsyncStorage key so the foreground can surface the
// last failure without crashing silently.
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendSamples, type RawTaskSample } from './recordingStore';

/** Canonical task name — referenced by startLocationUpdatesAsync /
 *  stopLocationUpdatesAsync / hasStartedLocationUpdatesAsync in
 *  useGPSRecorder. Exported so there is one string in the codebase. */
export const BACKGROUND_LOCATION_TASK_NAME = 'nwd-background-location';

/** AsyncStorage key for the most recent task-side error. The
 *  recording screen can read this on foreground to warn the rider
 *  if sample collection died mid-ride (e.g. iOS revoked Always
 *  permission silently). Phase 5 will consume this; Phase 3 only
 *  writes it so the plumbing is ready. */
export const TASK_LAST_ERROR_KEY = 'nwd:recording:lastError';

interface TaskData {
  locations?: Location.LocationObject[];
}

// Guard against double-define. React Native's Fast Refresh can
// re-execute module scope during development; defineTask is not
// idempotent and will throw on the second call. hasRegistered prevents
// that without hiding real errors (first call still throws if broken).
let hasRegistered = false;

function registerTask() {
  if (hasRegistered) return;
  hasRegistered = true;

  TaskManager.defineTask(
    BACKGROUND_LOCATION_TASK_NAME,
    async ({ data, error }: { data: TaskData | null; error: TaskManager.TaskManagerError | null }) => {
      if (error) {
        try {
          await AsyncStorage.setItem(
            TASK_LAST_ERROR_KEY,
            JSON.stringify({
              message: error.message ?? 'unknown',
              at: Date.now(),
            }),
          );
        } catch {
          // Storage itself failed — nothing useful we can do from
          // the headless context. The foreground will notice absence
          // of new samples on next tick and can surface a generic
          // "GPS przerwane" banner (Phase 5).
        }
        return;
      }

      const locations = data?.locations;
      if (!locations || locations.length === 0) return;

      // Codex C2 fencing: capture the active sessionId NOW, pass it
      // to appendSamples. If a session change completes between this
      // read and the queued mutation, the recordingStore mutex will
      // see a sessionId mismatch and drop the batch — preventing
      // late samples from polluting a freshly started session.
      //
      // Reading the raw AsyncStorage key directly because
      // peekRestorable's return shape doesn't expose sessionId yet
      // (Phase 3.5 Step 5 will add it and let this simplify to
      // a single helper call).
      let sessionId: string | null = null;
      try {
        const raw = await AsyncStorage.getItem('nwd:recording-buffer');
        if (raw) {
          const parsed = JSON.parse(raw) as { sessionId?: string };
          sessionId = parsed?.sessionId ?? null;
        }
      } catch {
        // Read failed; can't fence without a sessionId, bail.
      }
      if (!sessionId) {
        // No active session — samples from a task that outlived its
        // recording. Drop them; Phase 3's defensive mount-time
        // cleanup will stop the stale task on next foreground.
        return;
      }

      const samples: RawTaskSample[] = locations.map((loc) => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
      }));

      await appendSamples(sessionId, samples);
    },
  );
}

// Side-effect registration on import. Keep this last so the exported
// constants are available first (defensive against circular imports
// from recordingStore).
registerTask();
