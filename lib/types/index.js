/**
 * dsh-background — 自定义 WebUI 背景（宿主半身）。
 *
 * 通过 settings 服务注册 `background` 命名空间持久化配置；通过 webServer
 * 的 tapIndex 在每次 index.html 响应中注入背景 CSS；注册 /dsh-bg/img 图库
 * 图片路由；提供 bgDurable 服务（getState / saveState）供控制面板使用。
 */
import z from '@deepseek-ai/schemastery';
export const name = 'dsh-background';
export const inject = ['fs', 'settings', 'webServer'];
/** 配置 schema：驱动持久化校验与默认值。 */
export const BackgroundSchema = z.object({
    galleryDir: z.string().default(''),
    current: z.string().default(''),
    opacity: z.number().default(1),
    surface: z.number().default(0.75),
    blur: z.number().default(0),
    zoomX: z.number().default(100),
    zoomY: z.number().default(100),
    posX: z.number().default(50),
    posY: z.number().default(50),
    fit: z.union([z.const('cover'), z.const('contain'), z.const('fill')]).default('cover'),
    slideshow: z.object({
        enabled: z.boolean().default(false),
        seconds: z.number().default(60),
    }),
});
const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i;
const MAX_IMG = 16 * 1024 * 1024;
const MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml',
};
const LIGHT = { base: '#f6f7f9', l1: '#ffffff', l2: '#eef0f3', sb: '#eceef2', ov: '#ffffff' };
const DARK = { base: '#0d1017', l1: '#161b24', l2: '#1c222e', sb: '#11151d', ov: '#1c222e' };
/** Read a JSON request body, or undefined when absent/too large/unparseable. */
async function readJsonBody(req, maxBytes = 64 * 1024) {
    const chunks = [];
    let size = 0;
    try {
        for await (const chunk of req) {
            const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
            size += bytes.byteLength;
            if (size > maxBytes)
                return undefined;
            chunks.push(bytes);
        }
    }
    catch {
        return undefined;
    }
    if (chunks.length === 0)
        return undefined;
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder().decode(merged));
    }
    catch {
        return undefined;
    }
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function backgroundUrl(s) {
    if (!s.current || !s.galleryDir)
        return null;
    const base = s.galleryDir.replace(/[\\/]+$/, '');
    return '/dsh-bg/img?p=' + encodeURIComponent(base + '/' + s.current);
}
function fallbackGradient() {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0ea5e9'/><stop offset='0.45' stop-color='#4f46e5'/><stop offset='1' stop-color='#1e1b4b'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>";
    return "url('data:image/svg+xml;utf8," + encodeURIComponent(svg) + "')";
}
function imageValue(s) {
    const bare = backgroundUrl(s);
    return bare ? `url('${bare}')` : fallbackGradient();
}
function tokenBlock(c, a, oa) {
    return '--dsw-alias-bg-base:' + rgba(c.base, a) + '!important;' +
        '--dsw-alias-bg-layer-1:' + rgba(c.l1, a) + '!important;' +
        '--dsw-alias-bg-layer-2:' + rgba(c.l2, a) + '!important;' +
        '--dsw-specific-sidebar-fill:' + rgba(c.sb, a) + '!important;' +
        '--dsw-alias-bg-overlay:' + rgba(c.ov, oa) + '!important;';
}
/**
 * 生成背景 CSS。传入 prevUrl（旧图 URL）时输出交叉淡化双图层：
 * body::before 载入新图并淡入，body::after 载入旧图并淡出，keyframes 用
 * 时间戳命名保证每次重写 style 后动画都会重跑。
 */
function buildCss(s, prevUrl, dur = 600) {
    const size = s.fit === 'contain' ? 'contain' : s.fit === 'fill' ? '100% 100%' : 'cover';
    const pos = clamp(s.posX, 0, 100) + '% ' + clamp(s.posY, 0, 100) + '%';
    const zx = clamp(s.zoomX, 100, 800) / 100;
    const zy = clamp(s.zoomY, 100, 800) / 100;
    const op = clamp(s.opacity, 0, 1);
    const a = clamp(s.surface, 0, 1);
    const oa = Math.max(a, 0.96);
    const blur = clamp(s.blur, 0, 80);
    const img = imageValue(s);
    const layer = (image, z, opacity, extra) => 'content:"";position:fixed;inset:-' + blur + 'px;z-index:' + z + ';pointer-events:none;' +
        'background-image:' + image + ';background-repeat:no-repeat;background-size:' + size + ';' +
        'background-position:' + pos + ';transform:scale(' + zx + ',' + zy + ');' +
        'filter:blur(' + blur + 'px);opacity:' + opacity + ';' + extra;
    let css = 'html{background:#0d1017!important}body{background:transparent!important}';
    if (prevUrl) {
        const token = String(Date.now()) + Math.floor(Math.random() * 1000);
        const prev = "url('" + prevUrl + "')";
        css += 'body::before{' + layer(img, -1, '0', 'animation:dshbg-in-' + token + ' ' + dur + 'ms ease forwards;') + '}' +
            'body::after{' + layer(prev, -2, String(op), 'animation:dshbg-out-' + token + ' ' + dur + 'ms ease forwards;') + '}' +
            '@keyframes dshbg-in-' + token + '{from{opacity:0}to{opacity:' + op + '}}' +
            '@keyframes dshbg-out-' + token + '{from{opacity:' + op + '}to{opacity:0}}';
    }
    else {
        css += 'body::before{' + layer(img, -1, String(op), '') + '}';
    }
    css += 'body{' + tokenBlock(DARK, a, oa) + '}' +
        'body:not([data-ds-dark-theme]){' + tokenBlock(LIGHT, a, oa) + '}';
    return css;
}
function injectIntoHead(html, css) {
    const style = '<style id="dsh-bg-durable">' + css + '</style>';
    const m = /<\/head>/i.exec(html);
    if (m)
        return html.slice(0, m.index) + style + html.slice(m.index);
    return html + style;
}
export function apply(ctx) {
    const fs = ctx.get('fs');
    const settings = ctx.get('settings');
    const webServer = ctx.get('webServer');
    if (fs === undefined || settings === undefined) {
        console.error('[dsh-background] missing services', { fs: fs !== undefined, settings: settings !== undefined, webServer: webServer !== undefined });
        return;
    }
    try {
        settings.register('background', BackgroundSchema);
    }
    catch (error) {
        console.error('[dsh-background] settings.register failed:', error);
    }
    const readState = () => {
        const v = settings.get('background');
        return v && typeof v === 'object' ? v : {
            galleryDir: '', current: '', opacity: 1, surface: 0.75, blur: 0,
            zoomX: 100, zoomY: 100, posX: 50, posY: 50, fit: 'cover',
            slideshow: { enabled: false, seconds: 60 },
        };
    };
    const galleryItems = async (state) => {
        if (!state.galleryDir)
            return { dir: '', items: [] };
        try {
            const root = await fs.resolve(state.galleryDir);
            const entries = await fs.listDir(root);
            const items = [];
            for (const entry of entries) {
                if (!IMG_EXT.test(entry.name))
                    continue;
                items.push({ name: entry.name, url: '/dsh-bg/img?p=' + encodeURIComponent(fs.processPath(entry.target)) });
            }
            return { dir: state.galleryDir, items };
        }
        catch {
            return { dir: state.galleryDir, items: [] };
        }
    };
    const compose = async (state) => {
        const gallery = await galleryItems(state);
        let currentUrl = null;
        if (state.current) {
            const hit = gallery.items.find(i => i.name === state.current);
            currentUrl = hit ? hit.url : null;
        }
        return { state, gallery, currentUrl };
    };
    if (webServer !== undefined) {
        ctx.effect(() => webServer.tapIndex(html => injectIntoHead(html, buildCss(readState()))), 'dsh-background: index background');
        ctx.effect(() => webServer.register({
            kind: 'prefix',
            path: '/dsh-bg/img',
            async handler(req, res) {
                try {
                    const query = String(req.url ?? '').split('?')[1] ?? '';
                    let p = '';
                    for (const pair of query.split('&')) {
                        const eq = pair.indexOf('=');
                        const key = eq === -1 ? pair : pair.slice(0, eq);
                        if (key === 'p')
                            p = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
                    }
                    if (!p) {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.end('missing p');
                        return;
                    }
                    const state = readState();
                    if (!state.galleryDir) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('no gallery');
                        return;
                    }
                    const root = await fs.resolve(state.galleryDir);
                    const target = await fs.resolve(p);
                    if (!fs.contains(root, target)) {
                        res.writeHead(403, { 'Content-Type': 'text/plain' });
                        res.end('forbidden');
                        return;
                    }
                    const ext = (p.split('.').pop() ?? '').toLowerCase();
                    const type = MIME[ext] ?? 'application/octet-stream';
                    const bytes = await fs.readBytes(target, undefined, MAX_IMG);
                    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=600' });
                    res.end(bytes);
                }
                catch {
                    try {
                        if (!res.headersSent) {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('not found');
                        }
                    }
                    catch { /* ignore */ }
                }
            },
        }), 'dsh-background: image route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/dsh-bg/list',
            async handler(_req, res) {
                try {
                    const state = readState();
                    const gallery = await galleryItems(state);
                    let currentUrl = null;
                    if (state.current) {
                        const hit = gallery.items.find(i => i.name === state.current);
                        currentUrl = hit ? hit.url : null;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify({ dir: state.galleryDir, current: state.current, currentUrl, items: gallery.items }));
                }
                catch {
                    try {
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('error');
                        }
                    }
                    catch { /* ignore */ }
                }
            },
        }), 'dsh-background: gallery list');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/dsh-bg/state',
            async handler(_req, res) {
                try {
                    const payload = await compose(readState());
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify(payload));
                }
                catch {
                    try {
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('error');
                        }
                    }
                    catch { /* ignore */ }
                }
            },
        }), 'dsh-background: state route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/dsh-bg/save',
            async handler(req, res) {
                try {
                    const body = await readJsonBody(req);
                    const patch = (body !== null && typeof body === 'object' && !Array.isArray(body) && 'patch' in body)
                        ? body.patch
                        : body;
                    if (patch !== null && typeof patch === 'object' && !Array.isArray(patch)) {
                        await settings.update('background', patch);
                    }
                    const payload = await compose(readState());
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(JSON.stringify(payload));
                }
                catch {
                    try {
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('error');
                        }
                    }
                    catch { /* ignore */ }
                }
            },
        }), 'dsh-background: save route');
        ctx.effect(() => webServer.register({
            kind: 'exact',
            path: '/dsh-bg/css',
            async handler(req, res) {
                try {
                    const query = String(req.url ?? '').split('?')[1] ?? '';
                    const params = new Map();
                    for (const pair of query.split('&')) {
                        if (pair === '')
                            continue;
                        const eq = pair.indexOf('=');
                        const key = eq === -1 ? pair : pair.slice(0, eq);
                        if (key === '')
                            continue;
                        params.set(key, decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1)));
                    }
                    const prev = params.get('prev') || undefined;
                    const durRaw = Number(params.get('dur'));
                    const dur = Number.isFinite(durRaw) ? Math.max(100, Math.min(3000, durRaw)) : 600;
                    const css = buildCss(readState(), prev, dur);
                    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
                    res.end(css);
                }
                catch {
                    try {
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('error');
                        }
                    }
                    catch { /* ignore */ }
                }
            },
        }), 'dsh-background: css route');
    }
    ctx.provide('bgDurable', {
        getState: async () => compose(readState()),
        saveState: async (patch) => {
            try {
                await settings.update('background', patch);
            }
            catch { /* persistence is best-effort */ }
            return compose(readState());
        },
    });
}
//# sourceMappingURL=index.js.map