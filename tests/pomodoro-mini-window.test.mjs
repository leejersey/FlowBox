import test from 'node:test'
import assert from 'node:assert/strict'

const api = await import('../src/lib/pomodoroMiniWindow.ts').catch(() => ({}))
const normal = { size: { width: 1800, height: 1200 }, position: { x: 80, y: 100 }, resizable: true, alwaysOnTop: false, maximized: false }

function fake(initial = normal, failures = []) {
  const state = structuredClone(initial)
  const calls = []
  const errors = failures.map(name => ({ name, error: new Error(name) }))
  let gate
  const adapter = {}
  const methods = {
    isMaximized: () => state.maximized,
    isResizable: () => state.resizable,
    isAlwaysOnTop: () => state.alwaysOnTop,
    innerPhysicalSize: () => ({ ...state.size }),
    outerPhysicalPosition: () => ({ ...state.position }),
    unmaximize: () => { state.maximized = false },
    maximize: () => { state.maximized = true },
    setLogicalSize: (width, height) => { state.size = { width: width * 2, height: height * 2 } },
    setPhysicalSize: size => { state.size = { ...size } },
    setPhysicalPosition: position => { state.position = { ...position } },
    setResizable: value => { state.resizable = value },
    setAlwaysOnTop: value => { state.alwaysOnTop = value },
  }
  for (const [name, operation] of Object.entries(methods)) {
    adapter[name] = async (...args) => {
      calls.push([name, ...structuredClone(args)])
      if (gate?.name === name) { const pending = gate; gate = null; pending.started(); await pending.promise }
      const failure = errors.findIndex(item => item.name === name)
      if (failure !== -1) {
        const item = errors.splice(failure, 1)[0]
        if (item.afterMutation) operation(...args)
        throw item.error
      }
      return operation(...args)
    }
  }
  return { adapter, state, calls, fail(name, afterMutation = false) {
    errors.push({ name, error: new Error(name), afterMutation })
  }, block(name) {
    let release, started
    const promise = new Promise(resolve => { release = resolve })
    const entered = new Promise(resolve => { started = resolve })
    gate = { name, promise, started }
    return { release, entered }
  } }
}

function requireApi() { assert.equal(typeof api.createMiniWindowController, 'function', 'transaction module must exist') }

test('logical entry and physical restoration preserve flags and original geometry', async () => {
  requireApi()
  const f = fake()
  const snapshot = await api.enterMiniWindow(f.adapter)
  assert.deepEqual(snapshot, normal)
  assert.deepEqual(f.calls.filter(([name]) => name.startsWith('set')), [
    ['setLogicalSize', 340, 160], ['setResizable', false], ['setAlwaysOnTop', true],
  ])
  await api.restoreWindow(f.adapter, snapshot)
  assert.deepEqual(f.state, normal)
  assert.deepEqual(f.calls.filter(([name]) => name.startsWith('set')).slice(3), [
    ['setPhysicalSize', normal.size], ['setPhysicalPosition', normal.position], ['setResizable', true], ['setAlwaysOnTop', false],
  ])
})

test('maximized capture unmaximizes before geometry and restores maximize last', async () => {
  requireApi()
  const original = { ...normal, maximized: true }
  const f = fake(original)
  const snapshot = await api.enterMiniWindow(f.adapter)
  const names = f.calls.map(([name]) => name)
  assert.ok(names.indexOf('isMaximized') < names.indexOf('unmaximize'))
  assert.ok(names.indexOf('unmaximize') < names.indexOf('innerPhysicalSize'))
  assert.ok(names.indexOf('unmaximize') < names.indexOf('outerPhysicalPosition'))
  await api.restoreWindow(f.adapter, snapshot)
  assert.equal(f.calls.at(-1)[0], 'maximize')
  assert.deepEqual(f.state, original)
})

for (const name of ['isMaximized', 'isResizable', 'isAlwaysOnTop', 'unmaximize', 'innerPhysicalSize', 'outerPhysicalPosition', 'setLogicalSize', 'setResizable', 'setAlwaysOnTop']) {
  test(`entry failure at ${name} restores original maximized state`, async () => {
    requireApi()
    const original = { ...normal, maximized: true }
    const f = fake(original, [name])
    await assert.rejects(api.enterMiniWindow(f.adapter), error => error.message === name)
    assert.deepEqual(f.state, original)
    if (name === 'setAlwaysOnTop') {
      assert.deepEqual(f.calls.slice(-5).map(([method]) => method), ['setAlwaysOnTop', 'setResizable', 'setPhysicalSize', 'setPhysicalPosition', 'maximize'])
    }
  })
}

test('rollback failure preserves cause and continues remaining reverse operations', async () => {
  requireApi()
  const f = fake({ ...normal, maximized: true }, ['setAlwaysOnTop', 'setPhysicalSize'])
  await assert.rejects(api.enterMiniWindow(f.adapter), error => {
    assert.equal(error.cause.message, 'setAlwaysOnTop')
    assert.equal(error.errors[1].message, 'setPhysicalSize')
    return true
  })
  assert.deepEqual(f.calls.slice(-2).map(([name]) => name), ['setPhysicalPosition', 'maximize'])
})

test('duplicate queued enter never replaces original snapshot', async () => {
  requireApi()
  const f = fake()
  const controller = api.createMiniWindowController(f.adapter)
  await Promise.all([controller.enter(), controller.enter()])
  assert.equal(f.calls.filter(([name]) => name === 'setLogicalSize').length, 1)
  assert.equal(f.calls.filter(([name]) => name === 'innerPhysicalSize').length, 1)
  await controller.exit()
  assert.deepEqual(f.state, normal)
  assert.equal(controller.getState().mode, 'normal')
})

for (const action of ['exit', 'forceExit']) {
  test(`${action} during pending entry wins without interleaving`, async () => {
    requireApi()
    const f = fake()
    const gate = f.block('setLogicalSize')
    const controller = api.createMiniWindowController(f.adapter)
    const entry = controller.enter()
    await gate.entered
    const exit = controller[action]()
    assert.equal(controller.getState().desired, 'normal')
    assert.equal(f.calls.filter(([name]) => name === 'setPhysicalSize').length, 0)
    gate.release()
    await Promise.all([entry, exit])
    assert.deepEqual(f.state, normal)
    assert.equal(controller.getState().mode, 'normal')
  })
}

test('failed entry does not poison queue and a later enter succeeds', async () => {
  requireApi()
  const f = fake(normal, ['setLogicalSize'])
  const controller = api.createMiniWindowController(f.adapter)
  await assert.rejects(controller.enter(), /setLogicalSize/)
  await controller.enter()
  assert.equal(controller.getState().mode, 'mini')
  await controller.exit()
  assert.deepEqual(f.state, normal)
})

test('exit after pending entry failure reaches normal', async () => {
  requireApi()
  const f = fake(normal, ['setLogicalSize'])
  const gate = f.block('setLogicalSize')
  const controller = api.createMiniWindowController(f.adapter)
  const entry = controller.enter()
  const rejected = assert.rejects(entry, /setLogicalSize/)
  await gate.entered
  const exit = controller.exit()
  gate.release()
  await rejected
  await exit
  assert.deepEqual(f.state, normal)
  assert.equal(controller.getState().mode, 'normal')
})

for (const name of ['setLogicalSize', 'setResizable', 'setAlwaysOnTop', 'unmaximize']) {
  test(`mutation followed by rejection at ${name} still rolls back`, async () => {
    requireApi()
    const original = { ...normal, maximized: true }
    const f = fake(original)
    f.fail(name, true)
    await assert.rejects(api.enterMiniWindow(f.adapter), error => error.message === name)
    assert.deepEqual(f.state, original)
  })
}

for (const name of ['isMaximized', 'isResizable', 'isAlwaysOnTop', 'innerPhysicalSize', 'outerPhysicalPosition', 'setPhysicalSize', 'setPhysicalPosition', 'setResizable', 'setAlwaysOnTop', 'maximize']) {
  test(`restore failure at ${name} preserves mini state for retry`, async () => {
    requireApi()
    const f = fake({ ...normal, maximized: true })
    const snapshot = await api.enterMiniWindow(f.adapter)
    const mini = structuredClone(f.state)
    f.fail(name, name.startsWith('set') || name === 'maximize')
    await assert.rejects(api.restoreWindow(f.adapter, snapshot), error => error.message === name)
    assert.deepEqual(f.state, mini)
    await api.restoreWindow(f.adapter, snapshot)
    assert.deepEqual(f.state, snapshot)
  })
}

test('controller retains original snapshot after failed restoration', async () => {
  requireApi()
  const f = fake()
  const controller = api.createMiniWindowController(f.adapter)
  await controller.enter()
  f.fail('setPhysicalSize')
  await assert.rejects(controller.exit(), /setPhysicalSize/)
  assert.equal(controller.getState().mode, 'exiting')
  await controller.exit()
  assert.deepEqual(f.state, normal)
})

test('controller retries incomplete entry rollback using original snapshot', async () => {
  requireApi()
  const f = fake(normal, ['setAlwaysOnTop', 'setPhysicalSize'])
  const controller = api.createMiniWindowController(f.adapter)
  await assert.rejects(controller.enter(), AggregateError)
  assert.equal(controller.getState().mode, 'exiting')
  await controller.forceExit()
  assert.deepEqual(f.state, normal)
})

test('controller retries capture rollback even before full geometry is available', async () => {
  requireApi()
  const original = { ...normal, maximized: true }
  const f = fake(original, ['innerPhysicalSize', 'maximize'])
  const controller = api.createMiniWindowController(f.adapter)
  await assert.rejects(controller.enter(), AggregateError)
  assert.equal(controller.getState().mode, 'exiting')
  await controller.forceExit()
  assert.deepEqual(f.state, original)
  assert.equal(controller.getState().mode, 'normal')
})

test('exit while capture is pending cancels entry and restores maximized state', async () => {
  requireApi()
  const original = { ...normal, maximized: true }
  const f = fake(original)
  const controller = api.createMiniWindowController(f.adapter)
  const gate = f.block('innerPhysicalSize')
  const entry = controller.enter()
  await gate.entered
  const exit = controller.exit()
  gate.release()
  await Promise.all([entry, exit])
  assert.deepEqual(f.state, original)
  assert.equal(f.calls.filter(([name]) => name === 'setLogicalSize').length, 0)
})
