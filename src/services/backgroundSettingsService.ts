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

export interface AutostartPlugin {
  enable: () => Promise<void>
  disable: () => Promise<void>
  isEnabled: () => Promise<boolean>
}

type PersistSetting = (key: string, value: string) => Promise<unknown>

let autostartQueue: Promise<unknown> = Promise.resolve()

export async function syncAutostart(plugin: AutostartPlugin, persist: PersistSetting) {
  const enabled = await plugin.isEnabled()
  await persist('general.autostart', String(enabled))
  return enabled
}

export function setAutostart(
  enabled: boolean,
  plugin: AutostartPlugin,
  persist: PersistSetting,
) {
  const transition = autostartQueue.then(async () => {
    const previous = await plugin.isEnabled()
    try {
      await (enabled ? plugin.enable() : plugin.disable())
      const actual = await plugin.isEnabled()
      await persist('general.autostart', String(actual))
      return actual
    } catch (error) {
      let changed = enabled !== previous
      try {
        changed = await plugin.isEnabled() !== previous
      } catch {}
      if (changed) {
        try {
          await (previous ? plugin.enable() : plugin.disable())
        } catch {}
      }
      throw error
    }
  })
  autostartQueue = transition.catch(() => {})
  return transition
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
