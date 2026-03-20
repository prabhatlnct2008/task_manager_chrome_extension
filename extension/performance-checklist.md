# AnchorFlow — Performance Checklist

## Popup Performance

- [ ] Popup renders meaningful content within 100ms of open
- [ ] Batch-read all needed storage keys in a single `chrome.storage.local.get()` call
- [ ] No blocking API calls during popup mount
- [ ] Countdown timer uses `requestAnimationFrame` or low-frequency interval (1s), not tight loops
- [ ] Task list renders without layout thrashing (no forced reflows)
- [ ] Popup bundle size < 100KB gzipped (excluding shared chunks)

## Rendering Performance

- [ ] No unnecessary global re-renders — use React.memo on list items
- [ ] Task completion updates only the affected TaskItem + ProgressBar
- [ ] Checkbox interactions respond in < 50ms
- [ ] No expensive computations in render path (derived stats, date formatting)
- [ ] Use `useMemo` for derived values (filtered tasks, progress calculations)
- [ ] Avoid inline object/function creation in JSX props for memoized components

## Storage Performance

- [ ] Storage reads batched where possible
- [ ] No repeated storage hydration on every interaction
- [ ] Write-through pattern: update React state optimistically, persist async
- [ ] `chrome.storage.onChanged` listener is lightweight (only updates relevant state)
- [ ] Check-in history appends use efficient array operations
- [ ] Storage listener cleanup on component unmount

## Service Worker Performance

- [ ] Service worker starts and handles alarm in < 200ms
- [ ] No heavy computation in service worker (classification is async, non-blocking)
- [ ] Storage reads on wake are minimal (only what's needed for the current operation)
- [ ] No polling or setInterval in service worker (use chrome.alarms exclusively)

## Content Script / Overlay Performance

- [ ] Content script base load is < 20KB (before overlay is needed)
- [ ] Overlay React app mounts in < 100ms after message received
- [ ] Shadow DOM used — no style recalculation on host page
- [ ] Overlay CSS is self-contained (no external stylesheet loads)
- [ ] Overlay unmounts cleanly (no orphaned DOM nodes or listeners)
- [ ] Content script does NOT run on every page load (programmatic injection only)

## Bundle Size

- [ ] Separate entry points for popup, planner, stats, settings, background, content
- [ ] Shared code in common chunks (not duplicated per entry)
- [ ] Chart library (recharts/etc.) only included in stats bundle, lazy-loaded
- [ ] No large dependencies for simple tasks (no moment.js, no lodash full import)
- [ ] Tree-shaking enabled and verified
- [ ] Total extension size < 500KB uncompressed

## AI / Network Performance

- [ ] AI classification is non-blocking (overlay shows pending state)
- [ ] Timeout on AI requests (10s max)
- [ ] Fallback classification kicks in instantly on failure
- [ ] No retry loops for failed AI calls (fail fast, use fallback)
- [ ] API key validation does not block UI

## Charts / Stats Page

- [ ] Charts lazy-loaded (not in initial stats page bundle)
- [ ] Stats computations run once on mount, not on every render
- [ ] Date range changes recompute efficiently (not re-reading all storage)
- [ ] Activity table uses virtual scrolling if > 100 rows
- [ ] No chart animations that cause jank

## Memory

- [ ] No memory leaks from unsubscribed storage listeners
- [ ] No memory leaks from unmounted overlay components
- [ ] Check-in history pruned to 90 days (prevent unbounded growth)
- [ ] Side quests completed items pruned after 30 days

## General

- [ ] No `console.log` in production builds
- [ ] No synchronous `chrome.storage` calls (they don't exist in MV3, but verify)
- [ ] Extension does not request unnecessary permissions
- [ ] Icons are optimized (PNG, appropriate sizes only)
