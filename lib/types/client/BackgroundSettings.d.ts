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
export interface BackgroundState {
    galleryDir: string;
    current: string;
    opacity: number;
    surface: number;
    blur: number;
    zoomX: number;
    zoomY: number;
    posX: number;
    posY: number;
    fit: 'cover' | 'contain' | 'fill';
    slideshow: {
        enabled: boolean;
        seconds: number;
    };
}
/** 用宿主返回的当前背景 CSS 刷新（传 prevUrl 时请求交叉淡化双图层）。 */
export declare function applyBackgroundCss(prevUrl?: string): Promise<void>;
export declare function BackgroundSettings({ pickDirectory }: {
    pickDirectory?: () => Promise<string | null>;
}): import("react").JSX.Element;
//# sourceMappingURL=BackgroundSettings.d.ts.map