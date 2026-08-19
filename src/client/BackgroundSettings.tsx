/**
 * 背景设置页：状态与图库列表来自宿主半身的同源路由 /dsh-bg/state、/dsh-bg/save、
 * /dsh-bg/css，不经过官方 settings RPC（第三方命名空间不在 apiproxy allowlist 内）。
 *
 * 交互策略：
 * - 滑杆/裁切框拖动时用「本地 state → 本地生成 CSS」即时刷新背景（零延迟预览、
 *   跟手）；save 只做后台持久化，返回后不再覆盖本地数值字段（避免拖动回跳）；
 * - 点击缩略图 / 随机等换图操作走宿主交叉淡化 CSS（?prev= 双图层过渡）；
 * - 本地 CSS 生成逻辑与宿主 src/index.ts 的 buildCss 保持同步（改动需两处一起）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CropBox, type CropPatch } from './CropBox.tsx'

export interface BackgroundState {
  galleryDir: string
  current: string
  opacity: number
  surface: number
  blur: number
  zoomX: number
  zoomY: number
  posX: number
  posY: number
  fit: 'cover' | 'contain' | 'fill'
  slideshow: { enabled: boolean; seconds: number }
}

interface GalleryItem { name: string; url: string }
interface GalleryList { dir: string; items: GalleryItem[] }
interface StatePayload {
  state: BackgroundState
  gallery: GalleryList
  currentUrl: string | null
}

const DEFAULT_STATE: BackgroundState = {
  galleryDir: '', current: '', opacity: 1, surface: 0.75, blur: 0,
  zoomX: 100, zoomY: 100, posX: 50, posY: 50, fit: 'cover',
  slideshow: { enabled: false, seconds: 60 },
}

// ── 与宿主 src/index.ts 同步的本地 CSS 生成 ──────────────────────────────

const LIGHT = { base: '#f6f7f9', l1: '#ffffff', l2: '#eef0f3', sb: '#eceef2', ov: '#ffffff' }
const DARK = { base: '#0d1017', l1: '#161b24', l2: '#1c222e', sb: '#11151d', ov: '#1c222e' }

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)) }

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function fallbackGradient(): string {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0ea5e9'/><stop offset='0.45' stop-color='#4f46e5'/><stop offset='1' stop-color='#1e1b4b'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>"
  return "url('data:image/svg+xml;utf8," + encodeURIComponent(svg) + "')"
}

function tokenBlock(c: typeof DARK, a: number, oa: number): string {
  return '--dsw-alias-bg-base:' + rgba(c.base, a) + '!important;' +
    '--dsw-alias-bg-layer-1:' + rgba(c.l1, a) + '!important;' +
    '--dsw-alias-bg-layer-2:' + rgba(c.l2, a) + '!important;' +
    '--dsw-specific-sidebar-fill:' + rgba(c.sb, a) + '!important;' +
    '--dsw-alias-bg-overlay:' + rgba(c.ov, oa) + '!important;'
}

function backgroundImage(s: BackgroundState): string {
  if (!s.current || !s.galleryDir) return fallbackGradient()
  const base = s.galleryDir.replace(/[\\/]+$/, '')
  return "url('/dsh-bg/img?p=" + encodeURIComponent(base + '/' + s.current) + "')"
}

/** 本地即时生成背景 CSS（单图层，与宿主 buildCss 的图层规则一致）。 */
function buildLocalCss(s: BackgroundState): string {
  const size = s.fit === 'contain' ? 'contain' : s.fit === 'fill' ? '100% 100%' : 'cover'
  const pos = clamp(s.posX, 0, 100) + '% ' + clamp(s.posY, 0, 100) + '%'
  const zx = clamp(s.zoomX, 100, 800) / 100
  const zy = clamp(s.zoomY, 100, 800) / 100
  const op = clamp(s.opacity, 0, 1)
  const a = clamp(s.surface, 0, 1)
  const oa = Math.max(a, 0.96)
  const blur = clamp(s.blur, 0, 80)
  const img = backgroundImage(s)
  return 'html{background:#0d1017!important}body{background:transparent!important}' +
    'body::before{content:"";position:fixed;inset:-' + blur + 'px;z-index:-1;pointer-events:none;' +
    'background-image:' + img + ';background-repeat:no-repeat;background-size:' + size + ';' +
    'background-position:' + pos + ';transform:scale(' + zx + ',' + zy + ');opacity:' + op + ';' +
    'filter:blur(' + blur + 'px);}' +
    'body{' + tokenBlock(DARK, a, oa) + '}' +
    'body:not([data-ds-dark-theme]){' + tokenBlock(LIGHT, a, oa) + '}'
}

/** 写入 <style#dsh-bg-durable>（不存在则创建）。 */
function applyCssText(css: string): void {
  let tag = document.querySelector('style#dsh-bg-durable') as HTMLStyleElement | null
  if (tag === null) {
    tag = document.createElement('style')
    tag.id = 'dsh-bg-durable'
    document.head.appendChild(tag)
  }
  tag.textContent = css
}

/** 用本地 state 即时预览背景。 */
function applyLocalPreview(s: BackgroundState): void {
  applyCssText(buildLocalCss(s))
}

/** 用宿主返回的当前背景 CSS 刷新（传 prevUrl 时请求交叉淡化双图层）。 */
export async function applyBackgroundCss(prevUrl?: string): Promise<void> {
  try {
    const query = prevUrl
      ? '?prev=' + encodeURIComponent(prevUrl) + '&dur=600'
      : ''
    const res = await fetch('/dsh-bg/css' + query, { cache: 'no-store' })
    if (!res.ok) return
    applyCssText(await res.text())
  } catch { /* ignore */ }
}

// ── 组件 ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
}

const btnStyle: React.CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l1)',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
}

const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
  color: 'var(--dsw-alias-label-secondary)',
}

const rangeStyle: React.CSSProperties = { flex: 1, minWidth: 0, accentColor: 'var(--dsw-alias-brand-primary)' }

export function BackgroundSettings({ pickDirectory }: { pickDirectory?: () => Promise<string | null> }) {
  const [state, setState] = useState<BackgroundState>(DEFAULT_STATE)
  // 与 state 同步的最新镜像：交互 handler 里需要基于最新值派生出下一个 state。
  const stateRef = useRef<BackgroundState>(DEFAULT_STATE)
  const [gallery, setGallery] = useState<GalleryList>({ dir: '', items: [] })
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Draft-only field so the seconds input never loses a partially-typed value.
  const [secondsDraft, setSecondsDraft] = useState<string>('60')
  const secondsSyncedFrom = useRef<number | null>(null)

  // 当前显示中的图片 URL：换图（current 变化）时作为交叉淡化的旧图层。
  const lastShownUrl = useRef<string | null>(null)

  // Debounce machinery: pending patch merged across rapid changes, flushed once.
  const pendingPatch = useRef<Record<string, unknown>>({})
  const saveTimer = useRef<number | undefined>(undefined)

  /** 提交到宿主持久化。返回后只更新图库信息，不覆盖本地数值字段（避免回跳）。 */
  const commit = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/dsh-bg/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patch }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const payload = await res.json() as StatePayload
      const prev = 'current' in patch && lastShownUrl.current ? lastShownUrl.current : undefined
      setGallery(payload.gallery ?? { dir: '', items: [] })
      setCurrentUrl(payload.currentUrl ?? null)
      if (payload.currentUrl) lastShownUrl.current = payload.currentUrl
      setError(null)
      if ('current' in patch) {
        // 换图：宿主交叉淡化双图层。
        await applyBackgroundCss(prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [])

  const scheduleSave = useCallback((patch: Record<string, unknown>) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch }
    if (saveTimer.current !== undefined) clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      const p = pendingPatch.current
      pendingPatch.current = {}
      void commit(p)
    }, 180)
  }, [commit])

  const flushSave = useCallback(() => {
    if (saveTimer.current !== undefined) {
      clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    const p = pendingPatch.current
    pendingPatch.current = {}
    if (Object.keys(p).length > 0) void commit(p)
  }, [commit])

  const immediateSave = useCallback((patch: Record<string, unknown>) => {
    if (saveTimer.current !== undefined) {
      clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    const merged = { ...pendingPatch.current, ...patch }
    pendingPatch.current = {}
    void commit(merged)
  }, [commit])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/dsh-bg/state', { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const payload = await res.json() as StatePayload
      const st = payload.state ?? DEFAULT_STATE
      stateRef.current = st
      setState(st)
      setGallery(payload.gallery ?? { dir: '', items: [] })
      setCurrentUrl(payload.currentUrl ?? null)
      if (payload.currentUrl) lastShownUrl.current = payload.currentUrl
      setError(null)
      await applyBackgroundCss()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Keep the seconds draft in sync with the loaded state (only when not typing).
  useEffect(() => {
    if (secondsSyncedFrom.current !== state.slideshow.seconds) {
      secondsSyncedFrom.current = state.slideshow.seconds
      setSecondsDraft(String(state.slideshow.seconds))
    }
  }, [state.slideshow.seconds])

  /** 应用下一个本地 state（同步 ref + 触发渲染）。 */
  const applyNext = (next: BackgroundState): BackgroundState => {
    stateRef.current = next
    setState(next)
    return next
  }

  /** 滑杆：本地即时更新 + 本地即时预览 + debounce 持久化。 */
  const setRange = (k: keyof BackgroundState, v: number) => {
    const next = applyNext({ ...stateRef.current, [k]: v })
    applyLocalPreview(next)
    scheduleSave({ [k]: v })
  }

  /** 裁切框：同滑杆。 */
  const setCrop = (patch: CropPatch) => {
    const next = applyNext({ ...stateRef.current, ...patch })
    applyLocalPreview(next)
    scheduleSave(patch as Record<string, unknown>)
  }

  /** 换图：本地立即切换预览图，持久化后走交叉淡化。 */
  const pickImage = (name: string) => {
    applyNext({ ...stateRef.current, current: name })
    immediateSave({ current: name })
  }

  const pickRandom = () => {
    if (gallery.items.length === 0) return
    const pick = gallery.items[Math.floor(Math.random() * gallery.items.length)]
    if (pick) pickImage(pick.name)
  }

  /** 浏览文件夹：调起系统目录选择器，选中后立即保存并刷新图库。 */
  const onBrowse = async () => {
    if (!pickDirectory) return
    try {
      const path = await pickDirectory()
      if (path) {
        applyNext({ ...stateRef.current, galleryDir: path })
        immediateSave({ galleryDir: path })
      }
    } catch { /* 用户取消或失败，忽略 */ }
  }

  const commitSeconds = () => {
    const n = Number(secondsDraft)
    if (Number.isFinite(n) && n >= 1 && n !== stateRef.current.slideshow.seconds) {
      const slideshow = { ...stateRef.current.slideshow, seconds: Math.round(n) }
      applyNext({ ...stateRef.current, slideshow })
      immediateSave({ slideshow })
    } else {
      setSecondsDraft(String(stateRef.current.slideshow.seconds))
    }
  }

  const previewUrl = useMemo(() => (
    currentUrl ?? (state.current && state.galleryDir
      ? '/dsh-bg/img?p=' + encodeURIComponent(state.galleryDir + '/' + state.current)
      : null)
  ), [currentUrl, state.current, state.galleryDir])

  const numField = (label: string, key: keyof BackgroundState, min: number, max: number, step: number) => (
    <label key={key} style={fieldStyle}>
      <span style={{ width: 110, flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={Number(state[key] ?? min)}
        onChange={e => setRange(key, Number(e.target.value))}
        style={rangeStyle}
      />
      <span style={{ minWidth: 36, textAlign: 'right' }}>{String(state[key] ?? min)}</span>
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, padding: '4px 2px' }}>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--dsw-alias-status-danger, #e5484d)', border: '1px solid var(--dsw-alias-status-danger, #e5484d)', borderRadius: 8, padding: '8px 10px' }}>
          加载失败：{error}
        </div>
      )}

      <div>
        <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }}>图库文件夹</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ flex: 1, ...inputStyle }}
            value={state.galleryDir}
            onChange={e => applyNext({ ...stateRef.current, galleryDir: e.target.value })}
            onBlur={e => immediateSave({ galleryDir: e.target.value })}
            placeholder="例如 D:\Pictures\壁纸"
          />
          <button type="button" onClick={() => void onBrowse()} disabled={!pickDirectory} style={btnStyle}>浏览…</button>
          <button type="button" onClick={() => void load()} style={btnStyle}>刷新</button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }}>
          图库（{gallery.items.length} 张）· 当前：{state.current || '默认渐变'}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {gallery.items.map(item => (
            <img
              key={item.name} src={item.url} alt={item.name} title={item.name}
              onClick={() => pickImage(item.name)}
              style={{
                width: 72, height: 54, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
                border: item.name === state.current ? '2px solid var(--dsw-alias-brand-primary)' : '2px solid transparent',
              }}
            />
          ))}
        </div>
        <button type="button" onClick={pickRandom} disabled={gallery.items.length === 0} style={btnStyle}>随机一张</button>
      </div>

      {previewUrl && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }}>
            裁切框（拖动角点/边自由拉伸，拖动框内平移）
          </div>
          <CropBox
            previewUrl={previewUrl}
            zoomX={state.zoomX} zoomY={state.zoomY} posX={state.posX} posY={state.posY}
            onChange={setCrop}
            onCommit={flushSave}
          />
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>裁剪与效果</div>
      {numField('水平缩放', 'zoomX', 100, 800, 0.01)}
      {numField('垂直缩放', 'zoomY', 100, 800, 0.01)}
      {numField('水平位置', 'posX', 0, 100, 0.01)}
      {numField('垂直位置', 'posY', 0, 100, 0.01)}
      {numField('背景不透明度', 'opacity', 0, 1, 0.01)}
      {numField('面板透明度', 'surface', 0, 1, 0.01)}
      {numField('高斯模糊', 'blur', 0, 80, 0.01)}

      <label style={fieldStyle}>
        <span style={{ width: 110, flexShrink: 0 }}>显示模式</span>
        <select
          value={state.fit}
          onChange={e => {
            const fit = e.target.value as BackgroundState['fit']
            const next = applyNext({ ...stateRef.current, fit })
            applyLocalPreview(next)
            immediateSave({ fit })
          }}
          style={inputStyle}
        >
          <option value="cover">铺满裁剪 cover</option>
          <option value="contain">完整显示 contain</option>
          <option value="fill">拉伸填充 fill</option>
        </select>
      </label>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>轮播</div>
      <label style={fieldStyle}>
        <span style={{ width: 110, flexShrink: 0 }}>自动轮播</span>
        <input
          type="checkbox"
          checked={state.slideshow.enabled}
          onChange={e => {
            const slideshow = { ...stateRef.current.slideshow, enabled: e.target.checked }
            applyNext({ ...stateRef.current, slideshow })
            immediateSave({ slideshow })
          }}
        />
      </label>
      <label style={fieldStyle}>
        <span style={{ width: 110, flexShrink: 0 }}>切换间隔（秒）</span>
        <input
          type="number" min={1} step={1}
          value={secondsDraft}
          disabled={!state.slideshow.enabled}
          onChange={e => setSecondsDraft(e.target.value)}
          onBlur={commitSeconds}
          onKeyDown={e => { if (e.key === 'Enter') commitSeconds() }}
          style={{ width: 90, ...inputStyle }}
        />
      </label>

      {saving && (
        <div style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }}>正在保存…</div>
      )}
    </div>
  )
}
