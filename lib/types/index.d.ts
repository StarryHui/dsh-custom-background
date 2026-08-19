/**
 * dsh-background — 自定义 WebUI 背景（宿主半身）。
 *
 * 通过 settings 服务注册 `background` 命名空间持久化配置；通过 webServer
 * 的 tapIndex 在每次 index.html 响应中注入背景 CSS；注册 /dsh-bg/img 图库
 * 图片路由；提供 bgDurable 服务（getState / saveState）供控制面板使用。
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "dsh-background";
export declare const inject: string[];
/** 配置 schema：驱动持久化校验与默认值。 */
export declare const BackgroundSchema: z<Schemastery.ObjectS<{
    galleryDir: z<string, string>;
    current: z<string, string>;
    opacity: z<number, number>;
    surface: z<number, number>;
    blur: z<number, number>;
    zoomX: z<number, number>;
    zoomY: z<number, number>;
    posX: z<number, number>;
    posY: z<number, number>;
    fit: z<"cover" | "contain" | "fill", "cover" | "contain" | "fill">;
    slideshow: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        seconds: z<number, number>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        seconds: z<number, number>;
    }>>;
}>, Schemastery.ObjectT<{
    galleryDir: z<string, string>;
    current: z<string, string>;
    opacity: z<number, number>;
    surface: z<number, number>;
    blur: z<number, number>;
    zoomX: z<number, number>;
    zoomY: z<number, number>;
    posX: z<number, number>;
    posY: z<number, number>;
    fit: z<"cover" | "contain" | "fill", "cover" | "contain" | "fill">;
    slideshow: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        seconds: z<number, number>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        seconds: z<number, number>;
    }>>;
}>>;
export interface BackgroundSettings {
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
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map