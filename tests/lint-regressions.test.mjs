import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Idea highlight 异步选中且详情只由 selectedIdea 控制', async () => {
  const source = await readSource('../src/pages/IdeaPage.tsx')

  assert.doesNotMatch(source, /visibleSelectedIdea/)
  assert.match(source, /\{selectedIdea && \([\s\S]*?idea=\{selectedIdea\}/)
  assert.match(source, /onClose=\{\(\) => setSelectedIdea\(null\)\}/)
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*?setTimeout\(\(\) => setSelectedIdea\(null\)[\s\S]*?\}, \[highlight\]\)/)
  assert.match(source, /lastOpenedHighlightRef\.current === highlight/)
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*?setSelectedIdea\(idea\)/)
})

test('VirtualList 持续观察可见行尺寸并在 ref 卸载时断开 observer', async () => {
  const source = await readSource('../src/components/ui/VirtualList.tsx')

  assert.match(source, /rowObserversRef\s*=\s*useRef<Map<number, ResizeObserver>>/)
  assert.match(source, /const updateHeight[\s\S]*?setHeights\(/)
  assert.match(source, /new ResizeObserver\([\s\S]*?updateHeight\(index, height\)/)
  assert.match(source, /observer\.observe\(element\)/)
  assert.match(source, /existingObserver\?\.disconnect\(\)/)
  assert.match(source, /rowObserversRef\.current\.values\(\)[\s\S]*?observer\.disconnect\(\)/)
  assert.match(source, /return \(\) => observe\(index, null\)/)
  assert.match(source, /observe=\{observeRow\}/)
})

test('LinkPanel 卸载和并发 mutation 均由 mounted 与 latest-wins 保护', async () => {
  const source = await readSource('../src/components/links/LinkPanel.tsx')

  assert.match(source, /mountedRef\s*=\s*useRef\(false\)/)
  assert.match(source, /mutationIdRef\s*=\s*useRef\(0\)/)
  assert.match(source, /mountedRef\.current = true[\s\S]*?mountedRef\.current = false[\s\S]*?mutationIdRef\.current \+= 1/)
  assert.equal(source.match(/const mutationId = \+\+mutationIdRef\.current/g)?.length, 3)
  assert.equal(source.match(/mountedRef\.current && mutationId === mutationIdRef\.current/g)?.length, 6)
  assert.doesNotMatch(source, /setLinks\(await refresh\(\)\)/)
})
