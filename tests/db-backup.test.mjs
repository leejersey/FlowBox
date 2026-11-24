import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('数据库备份插件注册在 SQL 插件之前，确保恢复与迁移前快照先于数据库打开', async () => {
  const libRs = await readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')

  const backupIdx = libRs.indexOf('Builder::<tauri::Wry, ()>::new("db-backup")')
  const sqlIdx = libRs.indexOf('SqlBuilder::default()')
  assert.ok(backupIdx > 0, 'db-backup plugin should be registered')
  assert.ok(backupIdx < sqlIdx, 'db-backup plugin must be registered before the SQL plugin')
  assert.match(libRs, /prepare_on_startup\(app, latest_migration_version\)/)

  for (const cmd of ['db_backup_overview', 'db_backup_create', 'db_backup_restore', 'db_backup_delete', 'db_backup_reveal']) {
    assert.match(libRs, new RegExp(`commands::backup::${cmd}`))
  }
})

test('设置页展示真实数据库路径与备份恢复入口', async () => {
  const [settings, section] = await Promise.all([
    readFile(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/settings/DataBackupSection.tsx', import.meta.url), 'utf8'),
  ])

  assert.match(settings, /<DataBackupSection \/>/)
  assert.doesNotMatch(settings, /~\/\.local\/share\/com\.flowbox\.app/)
  assert.match(section, /overview\?\.db_path/)
  assert.match(section, /restoreBackupAndRelaunch/)
})
