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
  previousValue: string | null,
) {
  const [command] = BACKGROUND_SETTINGS[key]
  await deps.invoke(command, { enabled })
  try {
    await deps.set(key, String(enabled))
  } catch (error) {
    const previousEnabled = previousValue === null
      ? BACKGROUND_SETTINGS[key][1]
      : previousValue === 'true'
    try {
      await deps.invoke(command, { enabled: previousEnabled })
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], '设置写入及后台状态回滚均失败')
    }
    throw error
  }
}

export async function applyBackgroundSetting(
  key: BackgroundSettingKey,
  enabled: boolean,
  deps: BackgroundSettingDependencies,
) {
  return applyWithPreviousValue(key, enabled, deps, await deps.get(key))
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
