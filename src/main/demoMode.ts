import { app } from 'electron'

export function isDemoMode(): boolean {
  const markers = [
    process.env.DEMO_MODE,
    app.isReady() ? app.getName() : '',
    process.execPath,
    process.env.PORTABLE_EXECUTABLE_FILE
  ]

  return markers.some((value) => value?.toLowerCase().includes('demo'))
}
