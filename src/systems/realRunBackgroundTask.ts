// ═══════════════════════════════════════════════════════════
// realRunBackgroundTask — TaskManager definition for ranked /
// practice runs on already-pioneered trails (useRealRun path).
//
// Pairs with realRunBackgroundBuffer: the handler translates raw
// expo-location objects into GpsPoint shapes and pushes them into
// the ring buffer. useRealRun's 1 s tick drains the ring and feeds
// each new sample to the gate engine. Result: phone-in-pocket runs
// keep collecting samples after iOS backgrounds the app.
//
// TOP-LEVEL side effect by design — importing this module registers
// the task with expo-task-manager, which must happen during app
// init on every launch (including headless iOS wakeups). Root app
// import lives in app/_layout.tsx alongside the pioneer task.
//
// Why a second task name (not sharing pioneer's):
//   - Task handlers dispatch on name. Sharing would require the
//     single handler to know which flow is active and branch on it.
//   - Separate names means start/stop of one flow never affects the
//     other — if a rider bails on a ranked run to pioneer a new
//     trail, the wrong task can't end up running in the background.
//
// The handler runs outside React. No hooks, no setState. Its only
// job is pushing into the in-memory ring.
// ═══════════════════════════════════════════════════════════

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { push } from './realRunBackgroundBuffer';

export const REAL_RUN_LOCATION_TASK_NAME = 'nwd-real-run-location';

interface TaskData {
  locations?: Location.LocationObject[];
}

// Guard against double-define. Fast Refresh re-executes module scope
// in dev; defineTask is not idempotent and throws on the second call.
let hasRegistered = false;

function registerTask() {
  if (hasRegistered) return;
  hasRegistered = true;

  TaskManager.defineTask(
    REAL_RUN_LOCATION_TASK_NAME,
    async ({ data, error }: { data: TaskData | null; error: TaskManager.TaskManagerError | null }) => {
      if (error) {
        // Handler errors are surfaced via missing-samples on the
        // drain tick — foreground code already degrades on GPS
        // silence, so no extra reporting here.
        return;
      }

      const locations = data?.locations;
      if (!locations || locations.length === 0) return;

      for (const loc of locations) {
        push({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude ?? null,
          accuracy: loc.coords.accuracy ?? null,
          speed: loc.coords.speed ?? null,
          timestamp: loc.timestamp,
        });
      }
    },
  );
}

registerTask();
