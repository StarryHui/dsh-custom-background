/**
 * 自由拉伸裁切框：在预览图上拖拽一个矩形框，框代表「屏幕实际显示的区域」。
 * 框越小 → 放大越多（zoomX/zoomY 上升）；框移动 → 显示位置变化（posX/posY）。
 * 4 个角点独立调整两轴（非等比缩放），4 条边调整单轴，框内拖拽平移。
 *
 * 拖拽算法用「固定点 + 独立最大尺寸」：角/边拖动时固定对边/对角不动，候选
 * 宽高 clamp 到 [最小尺寸, 固定点允许的最大尺寸]，因此框永远留在容器内且
 * 不会出现拖出边界后反向移动的现象。
 */

import { useCallback, useRef } from 'react'

export interface CropPatch {
  zoomX?: number
  zoomY?: number
  posX?: number
  posY?: number
}

interface CropBoxProps {
  previewUrl: string
  zoomX: number
  zoomY: number
  posX: number
  posY: number
  /** 拖拽过程中逐帧回调（只更新本地 UI，跟手）。 */
  onChange: (patch: CropPatch) => void
  /** 拖拽结束回调（提交持久化 + 刷新背景）。 */
  onCommit: () => void
}

type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_ZOOM = 100
const MAX_ZOOM = 800

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)) }

function round2(v: number): number { return Math.round(v * 100) / 100 }

function cursorFor(h: Handle): string {
  if (h === 'nw' || h === 'se') return 'nwse-resize'
  if (h === 'ne' || h === 'sw') return 'nesw-resize'
  if (h === 'n' || h === 's') return 'ns-resize'
  if (h === 'e' || h === 'w') return 'ew-resize'
  return 'move'
}

const HANDLES: Array<{ id: Handle; style: React.CSSProperties }> = [
  { id: 'nw', style: { left: 0, top: 0 } },
  { id: 'n', style: { left: '50%', top: 0 } },
  { id: 'ne', style: { right: 0, top: 0 } },
  { id: 'e', style: { right: 0, top: '50%' } },
  { id: 'se', style: { right: 0, bottom: 0 } },
  { id: 's', style: { left: '50%', bottom: 0 } },
  { id: 'sw', style: { left: 0, bottom: 0 } },
  { id: 'w', style: { left: 0, top: '50%' } },
]

export function CropBox({ previewUrl, zoomX, zoomY, posX, posY, onChange, onCommit }: CropBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    handle: Handle
    startX: number
    startY: number
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
  } | null>(null)

  // 渲染几何（百分比，容器尺寸变化时自动适配）。
  const leftPct = posX - 5000 / zoomX
  const topPct = posY - 5000 / zoomY
  const widthPct = 10000 / zoomX
  const heightPct = 10000 / zoomY

  const emit = useCallback((left: number, top: number, right: number, bottom: number, W: number, H: number) => {
    const boxW = right - left
    const boxH = bottom - top
    const zx = clamp(W * 100 / boxW, MIN_ZOOM, MAX_ZOOM)
    const zy = clamp(H * 100 / boxH, MIN_ZOOM, MAX_ZOOM)
    const px = clamp((left + right) / 2 / W * 100, 0, 100)
    const py = clamp((top + bottom) / 2 / H * 100, 0, 100)
    onChange({ zoomX: round2(zx), zoomY: round2(zy), posX: round2(px), posY: round2(py) })
  }, [onChange])

  const onPointerDown = useCallback((handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const box = boxRef.current
    if (box === null || drag.current !== null) return
    const rect = box.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    const boxW = W * 100 / zoomX
    const boxH = H * 100 / zoomY
    const left = posX * W / 100 - boxW / 2
    const top = posY * H / 100 - boxH / 2
    drag.current = {
      handle, startX: e.clientX, startY: e.clientY,
      left, top, right: left + boxW, bottom: top + boxH,
      width: W, height: H,
    }

    const isE = handle === 'e' || handle === 'ne' || handle === 'se'
    const isW = handle === 'w' || handle === 'nw' || handle === 'sw'
    const isS = handle === 's' || handle === 'se' || handle === 'sw'
    const isN = handle === 'n' || handle === 'ne' || handle === 'nw'

    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (d === null) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      const W = d.width
      const H = d.height
      const minW = W * MIN_ZOOM / MAX_ZOOM
      const minH = H * MIN_ZOOM / MAX_ZOOM

      if (handle === 'move') {
        // 整体平移：保持宽高，整框约束在容器内。
        let left = d.left + dx
        let top = d.top + dy
        let right = d.right + dx
        let bottom = d.bottom + dy
        if (left < 0) { right -= left; left = 0 }
        if (top < 0) { bottom -= top; top = 0 }
        if (right > W) { left -= right - W; right = W }
        if (bottom > H) { top -= bottom - H; bottom = H }
        emit(left, top, right, bottom, W, H)
        return
      }

      // 角/边：固定对边/对角，候选宽高 clamp 到固定点允许的最大尺寸。
      let boxW = d.right - d.left
      let boxH = d.bottom - d.top
      if (isE || isW) boxW += dx
      if (isS || isN) boxH += dy
      const maxW = isW ? d.right : W - d.left
      const maxH = isN ? d.bottom : H - d.top
      boxW = clamp(boxW, minW, maxW)
      boxH = clamp(boxH, minH, maxH)
      let left = d.left
      let top = d.top
      let right = d.right
      let bottom = d.bottom
      if (isW) left = d.right - boxW
      if (isE) right = d.left + boxW
      if (isN) top = d.bottom - boxH
      if (isS) bottom = d.top + boxH
      emit(left, top, right, bottom, W, H)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (drag.current !== null) {
        drag.current = null
        onCommit()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [zoomX, zoomY, posX, posY, emit, onCommit])

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative', height: 240, borderRadius: 8, overflow: 'hidden',
        backgroundImage: `url('${previewUrl}')`, backgroundSize: 'cover',
        backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        touchAction: 'none', userSelect: 'none',
        border: '1px solid var(--dsw-alias-border-l1)',
      }}
    >
      <div
        onPointerDown={onPointerDown('move')}
        style={{
          position: 'absolute',
          left: leftPct + '%', top: topPct + '%',
          width: widthPct + '%', height: heightPct + '%',
          border: '1.5px dashed rgba(255,255,255,0.95)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          cursor: 'move',
          boxSizing: 'border-box',
        }}
      >
        {HANDLES.map(({ id, style }) => (
          <div
            key={id}
            onPointerDown={onPointerDown(id)}
            style={{
              position: 'absolute',
              width: 12, height: 12,
              transform: 'translate(-50%,-50%)',
              background: '#ffffff',
              border: '1.5px solid rgba(0,0,0,0.45)',
              borderRadius: 3,
              cursor: cursorFor(id),
              boxSizing: 'border-box',
              ...style,
            }}
          />
        ))}
      </div>
    </div>
  )
}
