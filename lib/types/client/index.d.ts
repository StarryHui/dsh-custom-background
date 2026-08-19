/**
 * dsh-background — 自定义 WebUI 背景（浏览器半身）。
 * 在设置侧边栏注册「背景」页面（与通用设置/模型/插件同级）；插件级轮播
 * 控制器实现多图交叉淡化轮播（顺序循环，切换时请求双图层 CSS 交叉淡化）。
 *
 * 状态读写不依赖官方 settings RPC（apiproxy 的 settings 命名空间 allowlist
 * 是硬编码的，第三方命名空间 `background` 永远拿到 settings-not-exposed），
 * 而是走宿主半身自建的同源路由 /dsh-bg/state、/dsh-bg/save、/dsh-bg/css。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map