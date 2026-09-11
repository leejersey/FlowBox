export const BACKGROUND_SETTINGS = {
  'clipboard.auto_watch': ['clipboard_set_watch', true],
  'general.app_tracking': ['app_usage_set_tracking', false],
} as const

export type BackgroundSettingKey = keyof typeof BACKGROUND_SETTINGS

export interface BackgroundSettingDependencies {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
  invoke: (command: string, payload: { enabled: boolean }) => Promise<unknown>
}

async function applyWithPreviousValue(
  key: BackgroundSettingKey,
  enabled: boolean,
  deps: BackgroundSettingDependencies,
  previousValue?: string | null,
) {
  const [command] = BACKGROUND_SETTINGS[key]
  await deps.invoke(command, { enabled })
  try {
    await deps.set(key, String(enabled))
  } catch (error) {
    try {
      const saved = previousValue === undefined ? await deps.get(key) : previousValue
      const previousEnabled = saved === null
        ? BACKGROUND_SETTINGS[key][1]
        : saved === 'true'
      await deps.invoke(command, { enabled: previousEnabled })
    } catch (rollbackError) {
      console.error('后台状态回滚失败', rollbackError)
    }
    throw error
  }
}

export async function applyBackgroundSetting(
  key: BackgroundSettingKey,
  enabled: boolean,
  deps: BackgroundSettingDependencies,
) {
  return applyWithPreviousValue(key, enabled, deps)
}

export async function syncBackgroundSettings(deps: BackgroundSettingDependencies) {
  for (const key of Object.keys(BACKGROUND_SETTINGS) as BackgroundSettingKey[]) {
    const saved = await deps.get(key)
    await applyWithPreviousValue(
      key,
      saved === null ? BACKGROUND_SETTINGS[key][1] : saved === 'true',
      deps,
      saved,
    )
  }
}
