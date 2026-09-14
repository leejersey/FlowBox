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

test('LinkPanel 卸载保护状态写入并串行提交 mutation', async () => {
  const source = await readSource('../src/components/links/LinkPanel.tsx')

  assert.match(source, /mountedRef\s*=\s*useRef\(false\)/)
  assert.match(source, /mutationQueueRef\s*=\s*useRef\(Promise\.resolve\(\)\)/)
  assert.match(source, /mutationQueueRef\.current\.then/)
  assert.match(source, /mutationQueueRef\.current = run/)
  assert.equal(source.match(/void mutate\(/g)?.length, 2)
  assert.match(source, /if \(mountedRef\.current\) \{[\s\S]*?setLinks\(items\)/)
  assert.doesNotMatch(source, /setLinks\(await refresh\(\)\)/)
})
