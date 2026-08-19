import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CropBox } from "./CropBox.js";
const DEFAULT_STATE = {
    galleryDir: '', current: '', opacity: 1, surface: 0.75, blur: 0,
    zoomX: 100, zoomY: 100, posX: 50, posY: 50, fit: 'cover',
    slideshow: { enabled: false, seconds: 60 },
};
// ── 与宿主 src/index.ts 同步的本地 CSS 生成 ──────────────────────────────
const LIGHT = { base: '#f6f7f9', l1: '#ffffff', l2: '#eef0f3', sb: '#eceef2', ov: '#ffffff' };
const DARK = { base: '#0d1017', l1: '#161b24', l2: '#1c222e', sb: '#11151d', ov: '#1c222e' };
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function fallbackGradient() {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0ea5e9'/><stop offset='0.45' stop-color='#4f46e5'/><stop offset='1' stop-color='#1e1b4b'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>";
    return "url('data:image/svg+xml;utf8," + encodeURIComponent(svg) + "')";
}
function tokenBlock(c, a, oa) {
    return '--dsw-alias-bg-base:' + rgba(c.base, a) + '!important;' +
        '--dsw-alias-bg-layer-1:' + rgba(c.l1, a) + '!important;' +
        '--dsw-alias-bg-layer-2:' + rgba(c.l2, a) + '!important;' +
        '--dsw-specific-sidebar-fill:' + rgba(c.sb, a) + '!important;' +
        '--dsw-alias-bg-overlay:' + rgba(c.ov, oa) + '!important;';
}
function backgroundImage(s) {
    if (!s.current || !s.galleryDir)
        return fallbackGradient();
    const base = s.galleryDir.replace(/[\\/]+$/, '');
    return "url('/dsh-bg/img?p=" + encodeURIComponent(base + '/' + s.current) + "')";
}
/** 本地即时生成背景 CSS（单图层，与宿主 buildCss 的图层规则一致）。 */
function buildLocalCss(s) {
    const size = s.fit === 'contain' ? 'contain' : s.fit === 'fill' ? '100% 100%' : 'cover';
    const pos = clamp(s.posX, 0, 100) + '% ' + clamp(s.posY, 0, 100) + '%';
    const zx = clamp(s.zoomX, 100, 800) / 100;
    const zy = clamp(s.zoomY, 100, 800) / 100;
    const op = clamp(s.opacity, 0, 1);
    const a = clamp(s.surface, 0, 1);
    const oa = Math.max(a, 0.96);
    const blur = clamp(s.blur, 0, 80);
    const img = backgroundImage(s);
    return 'html{background:#0d1017!important}body{background:transparent!important}' +
        'body::before{content:"";position:fixed;inset:-' + blur + 'px;z-index:-1;pointer-events:none;' +
        'background-image:' + img + ';background-repeat:no-repeat;background-size:' + size + ';' +
        'background-position:' + pos + ';transform:scale(' + zx + ',' + zy + ');opacity:' + op + ';' +
        'filter:blur(' + blur + 'px);}' +
        'body{' + tokenBlock(DARK, a, oa) + '}' +
        'body:not([data-ds-dark-theme]){' + tokenBlock(LIGHT, a, oa) + '}';
}
/** 写入 <style#dsh-bg-durable>（不存在则创建）。 */
function applyCssText(css) {
    let tag = document.querySelector('style#dsh-bg-durable');
    if (tag === null) {
        tag = document.createElement('style');
        tag.id = 'dsh-bg-durable';
        document.head.appendChild(tag);
    }
    tag.textContent = css;
}
/** 用本地 state 即时预览背景。 */
function applyLocalPreview(s) {
    applyCssText(buildLocalCss(s));
}
/** 用宿主返回的当前背景 CSS 刷新（传 prevUrl 时请求交叉淡化双图层）。 */
export async function applyBackgroundCss(prevUrl) {
    try {
        const query = prevUrl
            ? '?prev=' + encodeURIComponent(prevUrl) + '&dur=600'
            : '';
        const res = await fetch('/dsh-bg/css' + query, { cache: 'no-store' });
        if (!res.ok)
            return;
        applyCssText(await res.text());
    }
    catch { /* ignore */ }
}
// ── 组件 ──────────────────────────────────────────────────────────────────
const inputStyle = {
    border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-primary)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
};
const btnStyle = {
    background: 'var(--dsw-alias-bg-layer-2)',
    color: 'var(--dsw-alias-label-primary)',
    border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
};
const fieldStyle = {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
    color: 'var(--dsw-alias-label-secondary)',
};
const rangeStyle = { flex: 1, minWidth: 0, accentColor: 'var(--dsw-alias-brand-primary)' };
export function BackgroundSettings({ pickDirectory }) {
    const [state, setState] = useState(DEFAULT_STATE);
    // 与 state 同步的最新镜像：交互 handler 里需要基于最新值派生出下一个 state。
    const stateRef = useRef(DEFAULT_STATE);
    const [gallery, setGallery] = useState({ dir: '', items: [] });
    const [currentUrl, setCurrentUrl] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    // Draft-only field so the seconds input never loses a partially-typed value.
    const [secondsDraft, setSecondsDraft] = useState('60');
    const secondsSyncedFrom = useRef(null);
    // 当前显示中的图片 URL：换图（current 变化）时作为交叉淡化的旧图层。
    const lastShownUrl = useRef(null);
    // Debounce machinery: pending patch merged across rapid changes, flushed once.
    const pendingPatch = useRef({});
    const saveTimer = useRef(undefined);
    /** 提交到宿主持久化。返回后只更新图库信息，不覆盖本地数值字段（避免回跳）。 */
    const commit = useCallback(async (patch) => {
        setSaving(true);
        try {
            const res = await fetch('/dsh-bg/save', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ patch }),
            });
            if (!res.ok)
                throw new Error('HTTP ' + res.status);
            const payload = await res.json();
            const prev = 'current' in patch && lastShownUrl.current ? lastShownUrl.current : undefined;
            setGallery(payload.gallery ?? { dir: '', items: [] });
            setCurrentUrl(payload.currentUrl ?? null);
            if (payload.currentUrl)
                lastShownUrl.current = payload.currentUrl;
            setError(null);
            if ('current' in patch) {
                // 换图：宿主交叉淡化双图层。
                await applyBackgroundCss(prev);
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setSaving(false);
        }
    }, []);
    const scheduleSave = useCallback((patch) => {
        pendingPatch.current = { ...pendingPatch.current, ...patch };
        if (saveTimer.current !== undefined)
            clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            saveTimer.current = undefined;
            const p = pendingPatch.current;
            pendingPatch.current = {};
            void commit(p);
        }, 180);
    }, [commit]);
    const flushSave = useCallback(() => {
        if (saveTimer.current !== undefined) {
            clearTimeout(saveTimer.current);
            saveTimer.current = undefined;
        }
        const p = pendingPatch.current;
        pendingPatch.current = {};
        if (Object.keys(p).length > 0)
            void commit(p);
    }, [commit]);
    const immediateSave = useCallback((patch) => {
        if (saveTimer.current !== undefined) {
            clearTimeout(saveTimer.current);
            saveTimer.current = undefined;
        }
        const merged = { ...pendingPatch.current, ...patch };
        pendingPatch.current = {};
        void commit(merged);
    }, [commit]);
    const load = useCallback(async () => {
        try {
            const res = await fetch('/dsh-bg/state', { cache: 'no-store' });
            if (!res.ok)
                throw new Error('HTTP ' + res.status);
            const payload = await res.json();
            const st = payload.state ?? DEFAULT_STATE;
            stateRef.current = st;
            setState(st);
            setGallery(payload.gallery ?? { dir: '', items: [] });
            setCurrentUrl(payload.currentUrl ?? null);
            if (payload.currentUrl)
                lastShownUrl.current = payload.currentUrl;
            setError(null);
            await applyBackgroundCss();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    // Keep the seconds draft in sync with the loaded state (only when not typing).
    useEffect(() => {
        if (secondsSyncedFrom.current !== state.slideshow.seconds) {
            secondsSyncedFrom.current = state.slideshow.seconds;
            setSecondsDraft(String(state.slideshow.seconds));
        }
    }, [state.slideshow.seconds]);
    /** 应用下一个本地 state（同步 ref + 触发渲染）。 */
    const applyNext = (next) => {
        stateRef.current = next;
        setState(next);
        return next;
    };
    /** 滑杆：本地即时更新 + 本地即时预览 + debounce 持久化。 */
    const setRange = (k, v) => {
        const next = applyNext({ ...stateRef.current, [k]: v });
        applyLocalPreview(next);
        scheduleSave({ [k]: v });
    };
    /** 裁切框：同滑杆。 */
    const setCrop = (patch) => {
        const next = applyNext({ ...stateRef.current, ...patch });
        applyLocalPreview(next);
        scheduleSave(patch);
    };
    /** 换图：本地立即切换预览图，持久化后走交叉淡化。 */
    const pickImage = (name) => {
        applyNext({ ...stateRef.current, current: name });
        immediateSave({ current: name });
    };
    const pickRandom = () => {
        if (gallery.items.length === 0)
            return;
        const pick = gallery.items[Math.floor(Math.random() * gallery.items.length)];
        if (pick)
            pickImage(pick.name);
    };
    /** 浏览文件夹：调起系统目录选择器，选中后立即保存并刷新图库。 */
    const onBrowse = async () => {
        if (!pickDirectory)
            return;
        try {
            const path = await pickDirectory();
            if (path) {
                applyNext({ ...stateRef.current, galleryDir: path });
                immediateSave({ galleryDir: path });
            }
        }
        catch { /* 用户取消或失败，忽略 */ }
    };
    const commitSeconds = () => {
        const n = Number(secondsDraft);
        if (Number.isFinite(n) && n >= 1 && n !== stateRef.current.slideshow.seconds) {
            const slideshow = { ...stateRef.current.slideshow, seconds: Math.round(n) };
            applyNext({ ...stateRef.current, slideshow });
            immediateSave({ slideshow });
        }
        else {
            setSecondsDraft(String(stateRef.current.slideshow.seconds));
        }
    };
    const previewUrl = useMemo(() => (currentUrl ?? (state.current && state.galleryDir
        ? '/dsh-bg/img?p=' + encodeURIComponent(state.galleryDir + '/' + state.current)
        : null)), [currentUrl, state.current, state.galleryDir]);
    const numField = (label, key, min, max, step) => (_jsxs("label", { style: fieldStyle, children: [_jsx("span", { style: { width: 110, flexShrink: 0 }, children: label }), _jsx("input", { type: "range", min: min, max: max, step: step, value: Number(state[key] ?? min), onChange: e => setRange(key, Number(e.target.value)), style: rangeStyle }), _jsx("span", { style: { minWidth: 36, textAlign: 'right' }, children: String(state[key] ?? min) })] }, key));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, padding: '4px 2px' }, children: [error && (_jsxs("div", { style: { fontSize: 12, color: 'var(--dsw-alias-status-danger, #e5484d)', border: '1px solid var(--dsw-alias-status-danger, #e5484d)', borderRadius: 8, padding: '8px 10px' }, children: ["\u52A0\u8F7D\u5931\u8D25\uFF1A", error] })), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }, children: "\u56FE\u5E93\u6587\u4EF6\u5939" }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("input", { style: { flex: 1, ...inputStyle }, value: state.galleryDir, onChange: e => applyNext({ ...stateRef.current, galleryDir: e.target.value }), onBlur: e => immediateSave({ galleryDir: e.target.value }), placeholder: "\u4F8B\u5982 D:\\Pictures\\\u58C1\u7EB8" }), _jsx("button", { type: "button", onClick: () => void onBrowse(), disabled: !pickDirectory, style: btnStyle, children: "\u6D4F\u89C8\u2026" }), _jsx("button", { type: "button", onClick: () => void load(), style: btnStyle, children: "\u5237\u65B0" })] })] }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }, children: ["\u56FE\u5E93\uFF08", gallery.items.length, " \u5F20\uFF09\u00B7 \u5F53\u524D\uFF1A", state.current || '默认渐变'] }), _jsx("div", { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }, children: gallery.items.map(item => (_jsx("img", { src: item.url, alt: item.name, title: item.name, onClick: () => pickImage(item.name), style: {
                                width: 72, height: 54, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
                                border: item.name === state.current ? '2px solid var(--dsw-alias-brand-primary)' : '2px solid transparent',
                            } }, item.name))) }), _jsx("button", { type: "button", onClick: pickRandom, disabled: gallery.items.length === 0, style: btnStyle, children: "\u968F\u673A\u4E00\u5F20" })] }), previewUrl && (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginBottom: 6 }, children: "\u88C1\u5207\u6846\uFF08\u62D6\u52A8\u89D2\u70B9/\u8FB9\u81EA\u7531\u62C9\u4F38\uFF0C\u62D6\u52A8\u6846\u5185\u5E73\u79FB\uFF09" }), _jsx(CropBox, { previewUrl: previewUrl, zoomX: state.zoomX, zoomY: state.zoomY, posX: state.posX, posY: state.posY, onChange: setCrop, onCommit: flushSave })] })), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: "\u88C1\u526A\u4E0E\u6548\u679C" }), numField('水平缩放', 'zoomX', 100, 800, 0.01), numField('垂直缩放', 'zoomY', 100, 800, 0.01), numField('水平位置', 'posX', 0, 100, 0.01), numField('垂直位置', 'posY', 0, 100, 0.01), numField('背景不透明度', 'opacity', 0, 1, 0.01), numField('面板透明度', 'surface', 0, 1, 0.01), numField('高斯模糊', 'blur', 0, 80, 0.01), _jsxs("label", { style: fieldStyle, children: [_jsx("span", { style: { width: 110, flexShrink: 0 }, children: "\u663E\u793A\u6A21\u5F0F" }), _jsxs("select", { value: state.fit, onChange: e => {
                            const fit = e.target.value;
                            const next = applyNext({ ...stateRef.current, fit });
                            applyLocalPreview(next);
                            immediateSave({ fit });
                        }, style: inputStyle, children: [_jsx("option", { value: "cover", children: "\u94FA\u6EE1\u88C1\u526A cover" }), _jsx("option", { value: "contain", children: "\u5B8C\u6574\u663E\u793A contain" }), _jsx("option", { value: "fill", children: "\u62C9\u4F38\u586B\u5145 fill" })] })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: "\u8F6E\u64AD" }), _jsxs("label", { style: fieldStyle, children: [_jsx("span", { style: { width: 110, flexShrink: 0 }, children: "\u81EA\u52A8\u8F6E\u64AD" }), _jsx("input", { type: "checkbox", checked: state.slideshow.enabled, onChange: e => {
                            const slideshow = { ...stateRef.current.slideshow, enabled: e.target.checked };
                            applyNext({ ...stateRef.current, slideshow });
                            immediateSave({ slideshow });
                        } })] }), _jsxs("label", { style: fieldStyle, children: [_jsx("span", { style: { width: 110, flexShrink: 0 }, children: "\u5207\u6362\u95F4\u9694\uFF08\u79D2\uFF09" }), _jsx("input", { type: "number", min: 1, step: 1, value: secondsDraft, disabled: !state.slideshow.enabled, onChange: e => setSecondsDraft(e.target.value), onBlur: commitSeconds, onKeyDown: e => { if (e.key === 'Enter')
                            commitSeconds(); }, style: { width: 90, ...inputStyle } })] }), saving && (_jsx("div", { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }, children: "\u6B63\u5728\u4FDD\u5B58\u2026" }))] }));
}
//# sourceMappingURL=BackgroundSettings.js.map