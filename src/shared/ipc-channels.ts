export const IPC = {
  // Renderer → Main (invoke)
  BLUETOOTH_SCAN_START: 'bluetooth:scan-start',
  BLUETOOTH_SCAN_STOP: 'bluetooth:scan-stop',
  BLUETOOTH_CONNECT: 'bluetooth:connect',
  BLUETOOTH_DISCONNECT: 'bluetooth:disconnect',
  RACE_START: 'race:start',
  RACE_GO: 'race:go',
  RACE_STOP: 'race:stop',
  EVENT_SAVE: 'event:save',
  EVENT_LOAD: 'event:load',
  EVENT_CLEAR: 'event:clear',
  EVENT_EXPORT_CSV: 'event:export-csv',

  // Main → Renderer (send/on)
  BLUETOOTH_DEVICE_FOUND: 'bluetooth:device-found',
  BLUETOOTH_DEVICE_CONNECTED: 'bluetooth:device-connected',
  BLUETOOTH_DEVICE_DISCONNECTED: 'bluetooth:device-disconnected',
  BLUETOOTH_DEVICE_ERROR: 'bluetooth:device-error',
  RACE_TELEMETRY: 'race:telemetry',
  RACE_FINISHED: 'race:finished'
} as const
