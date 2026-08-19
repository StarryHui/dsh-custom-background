/**
 * dsh-background — 自定义 WebUI 背景（浏览器半身）。
 * 在设置侧边栏注册「背景」页面（与通用设置/模型/插件同级）；插件级轮播
 * 控制器实现多图交叉淡化轮播（顺序循环，切换时请求双图层 CSS 交叉淡化）。
 *
 * 状态读写不依赖官方 settings RPC（apiproxy 的 settings 命名空间 allowlist
 * 是硬编码的，第三方命名空间 `background` 永远拿到 settings-not-exposed），
 * 而是走宿主半身自建的同源路由 /dsh-bg/state、/dsh-bg/save、/dsh-bg/css。
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Context merge: the 'settings.section' slot (type-only).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BackgroundSettings, applyBackgroundCss } from './BackgroundSettings.tsx'

export const inject = ['slots', 'workspaces']

/** 轮询配置的间隔：用户改轮播开关/间隔后最多这么久内生效。 */
const CONFIG_POLL_MS = 5000

interface SlideshowPayload {
  state?: {
    current?: string
    slideshow?: { enabled?: boolean; seconds?: number }
  }
  gallery?: { items?: Array<{ name: string; url: string }> }
  currentUrl?: string | null
}

/** 按图库顺序取当前图的下一个（循环）。 */
function nextName(items: Array<{ name: string }>, current: string): string | undefined {
  if (items.length === 0) return undefined
  const idx = items.findIndex(i => i.name === current)
  const next = items[(idx + 1) % items.length]
  return next?.name
}

export function apply(ctx: ClientContext): void {
  // 系统文件夹选择（官方 host.pickDirectory 的浏览器侧封装；loopback 页面可用）。
  const pickDirectory = (): Promise<string | null> => ctx.workspaces.pickDirectory()

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'background',
    // 排在 agent 预设（order 20）下面：通用设置0 → 模型10 → 插件15 → agent预设20 → 背景21
    order: 21,
    label: () => '背景',
    inject: () => ({ pickDirectory }),
  }, BackgroundSettings))

  // 多图交叉淡化轮播：配置变化时重启定时器；每次触发读最新状态、顺序切到
  // 下一张、请求双图层 CSS 做交叉淡化。
  ctx.effect(() => {
    let timer: number | undefined
    let poll: number | undefined
    let disposed = false
    let inFlight = false
    let lastConfig = ''

    const run = async (fn: () => Promise<void>): Promise<void> => {
      if (disposed || inFlight) return
      inFlight = true
      try { await fn() } catch { /* ignore */ } finally { inFlight = false }
    }

    const advance = async (): Promise<void> => {
      const res = await fetch('/dsh-bg/state', { cache: 'no-store' })
      if (!res.ok) return
      const payload = await res.json() as SlideshowPayload
      const items = payload.gallery?.items ?? []
      if (items.length < 2) return
      const current = payload.state?.current ?? ''
      const next = nextName(items, current)
      if (next === undefined || next === current) return
      const prevUrl = payload.currentUrl ?? undefined
      const saveRes = await fetch('/dsh-bg/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patch: { current: next } }),
      })
      if (!saveRes.ok) return
      await applyBackgroundCss(prevUrl)
    }

    const sync = async (): Promise<void> => {
      const res = await fetch('/dsh-bg/state', { cache: 'no-store' })
      if (!res.ok) return
      const payload = await res.json() as SlideshowPayload
      const enabled = payload.state?.slideshow?.enabled === true
      const seconds = Math.max(1, Math.round(payload.state?.slideshow?.seconds ?? 60))
      const itemsKey = (payload.gallery?.items ?? []).map(i => i.name).join('|')
      const cfg = JSON.stringify([enabled, seconds, itemsKey])
      if (cfg === lastConfig) return
      lastConfig = cfg
      if (timer !== undefined) { clearInterval(timer); timer = undefined }
      if (enabled && (payload.gallery?.items?.length ?? 0) >= 2) {
        timer = window.setInterval(() => { void run(advance) }, seconds * 1000)
      }
    }

    void run(sync)
    poll = window.setInterval(() => { void run(sync) }, CONFIG_POLL_MS)
    return () => {
      disposed = true
      if (poll !== undefined) clearInterval(poll)
      if (timer !== undefined) clearInterval(timer)
    }
  }, 'dsh-background: slideshow')
}
