/**
 * 自由拉伸裁切框：在预览图上拖拽一个矩形框，框代表「屏幕实际显示的区域」。
 * 框越小 → 放大越多（zoomX/zoomY 上升）；框移动 → 显示位置变化（posX/posY）。
 * 4 个角点独立调整两轴（非等比缩放），4 条边调整单轴，框内拖拽平移。
 *
 * 拖拽算法用「固定点 + 独立最大尺寸」：角/边拖动时固定对边/对角不动，候选
 * 宽高 clamp 到 [最小尺寸, 固定点允许的最大尺寸]，因此框永远留在容器内且
 * 不会出现拖出边界后反向移动的现象。
 */
export interface CropPatch {
    zoomX?: number;
    zoomY?: number;
    posX?: number;
    posY?: number;
}
interface CropBoxProps {
    previewUrl: string;
    zoomX: number;
    zoomY: number;
    posX: number;
    posY: number;
    /** 拖拽过程中逐帧回调（只更新本地 UI，跟手）。 */
    onChange: (patch: CropPatch) => void;
    /** 拖拽结束回调（提交持久化 + 刷新背景）。 */
    onCommit: () => void;
}
export declare function CropBox({ previewUrl, zoomX, zoomY, posX, posY, onChange, onCommit }: CropBoxProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=CropBox.d.ts.map