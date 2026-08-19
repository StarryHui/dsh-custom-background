window.__ModuleLoader__.load({
	id: "@starryhui/dsh-background",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/client/CropBox.js
		/**
		* 自由拉伸裁切框：在预览图上拖拽一个矩形框，框代表「屏幕实际显示的区域」。
		* 框越小 → 放大越多（zoomX/zoomY 上升）；框移动 → 显示位置变化（posX/posY）。
		* 4 个角点独立调整两轴（非等比缩放），4 条边调整单轴，框内拖拽平移。
		*
		* 拖拽算法用「固定点 + 独立最大尺寸」：角/边拖动时固定对边/对角不动，候选
		* 宽高 clamp 到 [最小尺寸, 固定点允许的最大尺寸]，因此框永远留在容器内且
		* 不会出现拖出边界后反向移动的现象。
		*/
		const MIN_ZOOM = 100;
		const MAX_ZOOM = 800;
		function clamp$1(v, lo, hi) {
			return Math.min(hi, Math.max(lo, v));
		}
		function round2(v) {
			return Math.round(v * 100) / 100;
		}
		function cursorFor(h) {
			if (h === "nw" || h === "se") return "nwse-resize";
			if (h === "ne" || h === "sw") return "nesw-resize";
			if (h === "n" || h === "s") return "ns-resize";
			if (h === "e" || h === "w") return "ew-resize";
			return "move";
		}
		const HANDLES = [
			{
				id: "nw",
				style: {
					left: 0,
					top: 0
				}
			},
			{
				id: "n",
				style: {
					left: "50%",
					top: 0
				}
			},
			{
				id: "ne",
				style: {
					right: 0,
					top: 0
				}
			},
			{
				id: "e",
				style: {
					right: 0,
					top: "50%"
				}
			},
			{
				id: "se",
				style: {
					right: 0,
					bottom: 0
				}
			},
			{
				id: "s",
				style: {
					left: "50%",
					bottom: 0
				}
			},
			{
				id: "sw",
				style: {
					left: 0,
					bottom: 0
				}
			},
			{
				id: "w",
				style: {
					left: 0,
					top: "50%"
				}
			}
		];
		function CropBox({ previewUrl, zoomX, zoomY, posX, posY, onChange, onCommit }) {
			const boxRef = (0, react.useRef)(null);
			const drag = (0, react.useRef)(null);
			const leftPct = posX - 5e3 / zoomX;
			const topPct = posY - 5e3 / zoomY;
			const widthPct = 1e4 / zoomX;
			const heightPct = 1e4 / zoomY;
			const emit = (0, react.useCallback)((left, top, right, bottom, W, H) => {
				const boxW = right - left;
				const boxH = bottom - top;
				const zx = clamp$1(W * 100 / boxW, MIN_ZOOM, MAX_ZOOM);
				const zy = clamp$1(H * 100 / boxH, MIN_ZOOM, MAX_ZOOM);
				const px = clamp$1((left + right) / 2 / W * 100, 0, 100);
				const py = clamp$1((top + bottom) / 2 / H * 100, 0, 100);
				onChange({
					zoomX: round2(zx),
					zoomY: round2(zy),
					posX: round2(px),
					posY: round2(py)
				});
			}, [onChange]);
			const onPointerDown = (0, react.useCallback)((handle) => (e) => {
				e.preventDefault();
				e.stopPropagation();
				const box = boxRef.current;
				if (box === null || drag.current !== null) return;
				const rect = box.getBoundingClientRect();
				const W = rect.width;
				const H = rect.height;
				const boxW = W * 100 / zoomX;
				const boxH = H * 100 / zoomY;
				const left = posX * W / 100 - boxW / 2;
				const top = posY * H / 100 - boxH / 2;
				drag.current = {
					handle,
					startX: e.clientX,
					startY: e.clientY,
					left,
					top,
					right: left + boxW,
					bottom: top + boxH,
					width: W,
					height: H
				};
				const isE = handle === "e" || handle === "ne" || handle === "se";
				const isW = handle === "w" || handle === "nw" || handle === "sw";
				const isS = handle === "s" || handle === "se" || handle === "sw";
				const isN = handle === "n" || handle === "ne" || handle === "nw";
				const move = (ev) => {
					const d = drag.current;
					if (d === null) return;
					const dx = ev.clientX - d.startX;
					const dy = ev.clientY - d.startY;
					const W = d.width;
					const H = d.height;
					const minW = W * MIN_ZOOM / MAX_ZOOM;
					const minH = H * MIN_ZOOM / MAX_ZOOM;
					if (handle === "move") {
						let left = d.left + dx;
						let top = d.top + dy;
						let right = d.right + dx;
						let bottom = d.bottom + dy;
						if (left < 0) {
							right -= left;
							left = 0;
						}
						if (top < 0) {
							bottom -= top;
							top = 0;
						}
						if (right > W) {
							left -= right - W;
							right = W;
						}
						if (bottom > H) {
							top -= bottom - H;
							bottom = H;
						}
						emit(left, top, right, bottom, W, H);
						return;
					}
					let boxW = d.right - d.left;
					let boxH = d.bottom - d.top;
					if (isE || isW) boxW += dx;
					if (isS || isN) boxH += dy;
					const maxW = isW ? d.right : W - d.left;
					const maxH = isN ? d.bottom : H - d.top;
					boxW = clamp$1(boxW, minW, maxW);
					boxH = clamp$1(boxH, minH, maxH);
					let left = d.left;
					let top = d.top;
					let right = d.right;
					let bottom = d.bottom;
					if (isW) left = d.right - boxW;
					if (isE) right = d.left + boxW;
					if (isN) top = d.bottom - boxH;
					if (isS) bottom = d.top + boxH;
					emit(left, top, right, bottom, W, H);
				};
				const up = () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
					window.removeEventListener("pointercancel", up);
					if (drag.current !== null) {
						drag.current = null;
						onCommit();
					}
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
				window.addEventListener("pointercancel", up);
			}, [
				zoomX,
				zoomY,
				posX,
				posY,
				emit,
				onCommit
			]);
			return (0, react_jsx_runtime.jsx)("div", {
				ref: boxRef,
				style: {
					position: "relative",
					height: 240,
					borderRadius: 8,
					overflow: "hidden",
					backgroundImage: `url('${previewUrl}')`,
					backgroundSize: "cover",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
					touchAction: "none",
					userSelect: "none",
					border: "1px solid var(--dsw-alias-border-l1)"
				},
				children: (0, react_jsx_runtime.jsx)("div", {
					onPointerDown: onPointerDown("move"),
					style: {
						position: "absolute",
						left: leftPct + "%",
						top: topPct + "%",
						width: widthPct + "%",
						height: heightPct + "%",
						border: "1.5px dashed rgba(255,255,255,0.95)",
						boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
						cursor: "move",
						boxSizing: "border-box"
					},
					children: HANDLES.map(({ id, style }) => (0, react_jsx_runtime.jsx)("div", {
						onPointerDown: onPointerDown(id),
						style: {
							position: "absolute",
							width: 12,
							height: 12,
							transform: "translate(-50%,-50%)",
							background: "#ffffff",
							border: "1.5px solid rgba(0,0,0,0.45)",
							borderRadius: 3,
							cursor: cursorFor(id),
							boxSizing: "border-box",
							...style
						}
					}, id))
				})
			});
		}
		//#endregion
		//#region lib/types/client/BackgroundSettings.js
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
		const DEFAULT_STATE = {
			galleryDir: "",
			current: "",
			opacity: 1,
			surface: .75,
			blur: 0,
			zoomX: 100,
			zoomY: 100,
			posX: 50,
			posY: 50,
			fit: "cover",
			slideshow: {
				enabled: false,
				seconds: 60
			}
		};
		const LIGHT = {
			base: "#f6f7f9",
			l1: "#ffffff",
			l2: "#eef0f3",
			sb: "#eceef2",
			ov: "#ffffff"
		};
		const DARK = {
			base: "#0d1017",
			l1: "#161b24",
			l2: "#1c222e",
			sb: "#11151d",
			ov: "#1c222e"
		};
		function clamp(v, lo, hi) {
			return Math.min(hi, Math.max(lo, v));
		}
		function rgba(hex, a) {
			const n = parseInt(hex.slice(1), 16);
			return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
		}
		function fallbackGradient() {
			return "url('data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0ea5e9'/><stop offset='0.45' stop-color='#4f46e5'/><stop offset='1' stop-color='#1e1b4b'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/></svg>") + "')";
		}
		function tokenBlock(c, a, oa) {
			return "--dsw-alias-bg-base:" + rgba(c.base, a) + "!important;--dsw-alias-bg-layer-1:" + rgba(c.l1, a) + "!important;--dsw-alias-bg-layer-2:" + rgba(c.l2, a) + "!important;--dsw-specific-sidebar-fill:" + rgba(c.sb, a) + "!important;--dsw-alias-bg-overlay:" + rgba(c.ov, oa) + "!important;";
		}
		function backgroundImage(s) {
			if (!s.current || !s.galleryDir) return fallbackGradient();
			const base = s.galleryDir.replace(/[\\/]+$/, "");
			return "url('/dsh-bg/img?p=" + encodeURIComponent(base + "/" + s.current) + "')";
		}
		/** 本地即时生成背景 CSS（单图层，与宿主 buildCss 的图层规则一致）。 */
		function buildLocalCss(s) {
			const size = s.fit === "contain" ? "contain" : s.fit === "fill" ? "100% 100%" : "cover";
			const pos = clamp(s.posX, 0, 100) + "% " + clamp(s.posY, 0, 100) + "%";
			const zx = clamp(s.zoomX, 100, 800) / 100;
			const zy = clamp(s.zoomY, 100, 800) / 100;
			const op = clamp(s.opacity, 0, 1);
			const a = clamp(s.surface, 0, 1);
			const oa = Math.max(a, .96);
			const blur = clamp(s.blur, 0, 80);
			const img = backgroundImage(s);
			return "html{background:#0d1017!important}body{background:transparent!important}body::before{content:\"\";position:fixed;inset:-" + blur + "px;z-index:-1;pointer-events:none;background-image:" + img + ";background-repeat:no-repeat;background-size:" + size + ";background-position:" + pos + ";transform:scale(" + zx + "," + zy + ");opacity:" + op + ";filter:blur(" + blur + "px);}body{" + tokenBlock(DARK, a, oa) + "}body:not([data-ds-dark-theme]){" + tokenBlock(LIGHT, a, oa) + "}";
		}
		/** 写入 <style#dsh-bg-durable>（不存在则创建）。 */
		function applyCssText(css) {
			let tag = document.querySelector("style#dsh-bg-durable");
			if (tag === null) {
				tag = document.createElement("style");
				tag.id = "dsh-bg-durable";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}
		/** 用本地 state 即时预览背景。 */
		function applyLocalPreview(s) {
			applyCssText(buildLocalCss(s));
		}
		/** 用宿主返回的当前背景 CSS 刷新（传 prevUrl 时请求交叉淡化双图层）。 */
		async function applyBackgroundCss(prevUrl) {
			try {
				const query = prevUrl ? "?prev=" + encodeURIComponent(prevUrl) + "&dur=600" : "";
				const res = await fetch("/dsh-bg/css" + query, { cache: "no-store" });
				if (!res.ok) return;
				applyCssText(await res.text());
			} catch {}
		}
		const inputStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-3)",
			color: "var(--dsw-alias-label-primary)",
			borderRadius: 8,
			padding: "6px 10px",
			fontSize: 13
		};
		const btnStyle = {
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: 8,
			padding: "6px 12px",
			fontSize: 13,
			cursor: "pointer"
		};
		const fieldStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		const rangeStyle = {
			flex: 1,
			minWidth: 0,
			accentColor: "var(--dsw-alias-brand-primary)"
		};
		function BackgroundSettings({ pickDirectory }) {
			const [state, setState] = (0, react.useState)(DEFAULT_STATE);
			const stateRef = (0, react.useRef)(DEFAULT_STATE);
			const [gallery, setGallery] = (0, react.useState)({
				dir: "",
				items: []
			});
			const [currentUrl, setCurrentUrl] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [secondsDraft, setSecondsDraft] = (0, react.useState)("60");
			const secondsSyncedFrom = (0, react.useRef)(null);
			const lastShownUrl = (0, react.useRef)(null);
			const pendingPatch = (0, react.useRef)({});
			const saveTimer = (0, react.useRef)(void 0);
			/** 提交到宿主持久化。返回后只更新图库信息，不覆盖本地数值字段（避免回跳）。 */
			const commit = (0, react.useCallback)(async (patch) => {
				setSaving(true);
				try {
					const res = await fetch("/dsh-bg/save", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ patch })
					});
					if (!res.ok) throw new Error("HTTP " + res.status);
					const payload = await res.json();
					const prev = "current" in patch && lastShownUrl.current ? lastShownUrl.current : void 0;
					setGallery(payload.gallery ?? {
						dir: "",
						items: []
					});
					setCurrentUrl(payload.currentUrl ?? null);
					if (payload.currentUrl) lastShownUrl.current = payload.currentUrl;
					setError(null);
					if ("current" in patch) await applyBackgroundCss(prev);
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setSaving(false);
				}
			}, []);
			const scheduleSave = (0, react.useCallback)((patch) => {
				pendingPatch.current = {
					...pendingPatch.current,
					...patch
				};
				if (saveTimer.current !== void 0) clearTimeout(saveTimer.current);
				saveTimer.current = window.setTimeout(() => {
					saveTimer.current = void 0;
					const p = pendingPatch.current;
					pendingPatch.current = {};
					commit(p);
				}, 180);
			}, [commit]);
			const flushSave = (0, react.useCallback)(() => {
				if (saveTimer.current !== void 0) {
					clearTimeout(saveTimer.current);
					saveTimer.current = void 0;
				}
				const p = pendingPatch.current;
				pendingPatch.current = {};
				if (Object.keys(p).length > 0) commit(p);
			}, [commit]);
			const immediateSave = (0, react.useCallback)((patch) => {
				if (saveTimer.current !== void 0) {
					clearTimeout(saveTimer.current);
					saveTimer.current = void 0;
				}
				const merged = {
					...pendingPatch.current,
					...patch
				};
				pendingPatch.current = {};
				commit(merged);
			}, [commit]);
			const load = (0, react.useCallback)(async () => {
				try {
					const res = await fetch("/dsh-bg/state", { cache: "no-store" });
					if (!res.ok) throw new Error("HTTP " + res.status);
					const payload = await res.json();
					const st = payload.state ?? DEFAULT_STATE;
					stateRef.current = st;
					setState(st);
					setGallery(payload.gallery ?? {
						dir: "",
						items: []
					});
					setCurrentUrl(payload.currentUrl ?? null);
					if (payload.currentUrl) lastShownUrl.current = payload.currentUrl;
					setError(null);
					await applyBackgroundCss();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
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
				applyLocalPreview(applyNext({
					...stateRef.current,
					[k]: v
				}));
				scheduleSave({ [k]: v });
			};
			/** 裁切框：同滑杆。 */
			const setCrop = (patch) => {
				applyLocalPreview(applyNext({
					...stateRef.current,
					...patch
				}));
				scheduleSave(patch);
			};
			/** 换图：本地立即切换预览图，持久化后走交叉淡化。 */
			const pickImage = (name) => {
				applyNext({
					...stateRef.current,
					current: name
				});
				immediateSave({ current: name });
			};
			const pickRandom = () => {
				if (gallery.items.length === 0) return;
				const pick = gallery.items[Math.floor(Math.random() * gallery.items.length)];
				if (pick) pickImage(pick.name);
			};
			/** 浏览文件夹：调起系统目录选择器，选中后立即保存并刷新图库。 */
			const onBrowse = async () => {
				if (!pickDirectory) return;
				try {
					const path = await pickDirectory();
					if (path) {
						applyNext({
							...stateRef.current,
							galleryDir: path
						});
						immediateSave({ galleryDir: path });
					}
				} catch {}
			};
			const commitSeconds = () => {
				const n = Number(secondsDraft);
				if (Number.isFinite(n) && n >= 1 && n !== stateRef.current.slideshow.seconds) {
					const slideshow = {
						...stateRef.current.slideshow,
						seconds: Math.round(n)
					};
					applyNext({
						...stateRef.current,
						slideshow
					});
					immediateSave({ slideshow });
				} else setSecondsDraft(String(stateRef.current.slideshow.seconds));
			};
			const previewUrl = (0, react.useMemo)(() => currentUrl ?? (state.current && state.galleryDir ? "/dsh-bg/img?p=" + encodeURIComponent(state.galleryDir + "/" + state.current) : null), [
				currentUrl,
				state.current,
				state.galleryDir
			]);
			const numField = (label, key, min, max, step) => (0, react_jsx_runtime.jsxs)("label", {
				style: fieldStyle,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						style: {
							width: 110,
							flexShrink: 0
						},
						children: label
					}),
					(0, react_jsx_runtime.jsx)("input", {
						type: "range",
						min,
						max,
						step,
						value: Number(state[key] ?? min),
						onChange: (e) => setRange(key, Number(e.target.value)),
						style: rangeStyle
					}),
					(0, react_jsx_runtime.jsx)("span", {
						style: {
							minWidth: 36,
							textAlign: "right"
						},
						children: String(state[key] ?? min)
					})
				]
			}, key);
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 14,
					maxWidth: 640,
					padding: "4px 2px"
				},
				children: [
					error && (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: 12,
							color: "var(--dsw-alias-status-danger, #e5484d)",
							border: "1px solid var(--dsw-alias-status-danger, #e5484d)",
							borderRadius: 8,
							padding: "8px 10px"
						},
						children: ["加载失败：", error]
					}),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							color: "var(--dsw-alias-label-secondary)",
							marginBottom: 6
						},
						children: "图库文件夹"
					}), (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 6
						},
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								style: {
									flex: 1,
									...inputStyle
								},
								value: state.galleryDir,
								onChange: (e) => applyNext({
									...stateRef.current,
									galleryDir: e.target.value
								}),
								onBlur: (e) => immediateSave({ galleryDir: e.target.value }),
								placeholder: "例如 D:\\Pictures\\壁纸"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void onBrowse(),
								disabled: !pickDirectory,
								style: btnStyle,
								children: "浏览…"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void load(),
								style: btnStyle,
								children: "刷新"
							})
						]
					})] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [
						(0, react_jsx_runtime.jsxs)("div", {
							style: {
								fontSize: 13,
								color: "var(--dsw-alias-label-secondary)",
								marginBottom: 6
							},
							children: [
								"图库（",
								gallery.items.length,
								" 张）· 当前：",
								state.current || "默认渐变"
							]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								gap: 8,
								overflowX: "auto",
								paddingBottom: 6
							},
							children: gallery.items.map((item) => (0, react_jsx_runtime.jsx)("img", {
								src: item.url,
								alt: item.name,
								title: item.name,
								onClick: () => pickImage(item.name),
								style: {
									width: 72,
									height: 54,
									objectFit: "cover",
									borderRadius: 6,
									cursor: "pointer",
									border: item.name === state.current ? "2px solid var(--dsw-alias-brand-primary)" : "2px solid transparent"
								}
							}, item.name))
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: pickRandom,
							disabled: gallery.items.length === 0,
							style: btnStyle,
							children: "随机一张"
						})
					] }),
					previewUrl && (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							color: "var(--dsw-alias-label-secondary)",
							marginBottom: 6
						},
						children: "裁切框（拖动角点/边自由拉伸，拖动框内平移）"
					}), (0, react_jsx_runtime.jsx)(CropBox, {
						previewUrl,
						zoomX: state.zoomX,
						zoomY: state.zoomY,
						posX: state.posX,
						posY: state.posY,
						onChange: setCrop,
						onCommit: flushSave
					})] }),
					(0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							fontWeight: 600,
							color: "var(--dsw-alias-label-primary)"
						},
						children: "裁剪与效果"
					}),
					numField("水平缩放", "zoomX", 100, 800, .01),
					numField("垂直缩放", "zoomY", 100, 800, .01),
					numField("水平位置", "posX", 0, 100, .01),
					numField("垂直位置", "posY", 0, 100, .01),
					numField("背景不透明度", "opacity", 0, 1, .01),
					numField("面板透明度", "surface", 0, 1, .01),
					numField("高斯模糊", "blur", 0, 80, .01),
					(0, react_jsx_runtime.jsxs)("label", {
						style: fieldStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: {
								width: 110,
								flexShrink: 0
							},
							children: "显示模式"
						}), (0, react_jsx_runtime.jsxs)("select", {
							value: state.fit,
							onChange: (e) => {
								const fit = e.target.value;
								applyLocalPreview(applyNext({
									...stateRef.current,
									fit
								}));
								immediateSave({ fit });
							},
							style: inputStyle,
							children: [
								(0, react_jsx_runtime.jsx)("option", {
									value: "cover",
									children: "铺满裁剪 cover"
								}),
								(0, react_jsx_runtime.jsx)("option", {
									value: "contain",
									children: "完整显示 contain"
								}),
								(0, react_jsx_runtime.jsx)("option", {
									value: "fill",
									children: "拉伸填充 fill"
								})
							]
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 13,
							fontWeight: 600,
							color: "var(--dsw-alias-label-primary)"
						},
						children: "轮播"
					}),
					(0, react_jsx_runtime.jsxs)("label", {
						style: fieldStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: {
								width: 110,
								flexShrink: 0
							},
							children: "自动轮播"
						}), (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: state.slideshow.enabled,
							onChange: (e) => {
								const slideshow = {
									...stateRef.current.slideshow,
									enabled: e.target.checked
								};
								applyNext({
									...stateRef.current,
									slideshow
								});
								immediateSave({ slideshow });
							}
						})]
					}),
					(0, react_jsx_runtime.jsxs)("label", {
						style: fieldStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: {
								width: 110,
								flexShrink: 0
							},
							children: "切换间隔（秒）"
						}), (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							step: 1,
							value: secondsDraft,
							disabled: !state.slideshow.enabled,
							onChange: (e) => setSecondsDraft(e.target.value),
							onBlur: commitSeconds,
							onKeyDown: (e) => {
								if (e.key === "Enter") commitSeconds();
							},
							style: {
								width: 90,
								...inputStyle
							}
						})]
					}),
					saving && (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							color: "var(--dsw-alias-label-secondary)"
						},
						children: "正在保存…"
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* dsh-background — 自定义 WebUI 背景（浏览器半身）。
		* 在设置侧边栏注册「背景」页面（与通用设置/模型/插件同级）；插件级轮播
		* 控制器实现多图交叉淡化轮播（顺序循环，切换时请求双图层 CSS 交叉淡化）。
		*
		* 状态读写不依赖官方 settings RPC（apiproxy 的 settings 命名空间 allowlist
		* 是硬编码的，第三方命名空间 `background` 永远拿到 settings-not-exposed），
		* 而是走宿主半身自建的同源路由 /dsh-bg/state、/dsh-bg/save、/dsh-bg/css。
		*/
		const inject = ["slots", "workspaces"];
		/** 轮询配置的间隔：用户改轮播开关/间隔后最多这么久内生效。 */
		const CONFIG_POLL_MS = 5e3;
		/** 按图库顺序取当前图的下一个（循环）。 */
		function nextName(items, current) {
			if (items.length === 0) return void 0;
			return items[(items.findIndex((i) => i.name === current) + 1) % items.length]?.name;
		}
		function apply(ctx) {
			const pickDirectory = () => ctx.workspaces.pickDirectory();
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "background",
				order: 21,
				label: () => "背景",
				inject: () => ({ pickDirectory })
			}, BackgroundSettings));
			ctx.effect(() => {
				let timer;
				let poll;
				let disposed = false;
				let inFlight = false;
				let lastConfig = "";
				const run = async (fn) => {
					if (disposed || inFlight) return;
					inFlight = true;
					try {
						await fn();
					} catch {} finally {
						inFlight = false;
					}
				};
				const advance = async () => {
					const res = await fetch("/dsh-bg/state", { cache: "no-store" });
					if (!res.ok) return;
					const payload = await res.json();
					const items = payload.gallery?.items ?? [];
					if (items.length < 2) return;
					const current = payload.state?.current ?? "";
					const next = nextName(items, current);
					if (next === void 0 || next === current) return;
					const prevUrl = payload.currentUrl ?? void 0;
					if (!(await fetch("/dsh-bg/save", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ patch: { current: next } })
					})).ok) return;
					await applyBackgroundCss(prevUrl);
				};
				const sync = async () => {
					const res = await fetch("/dsh-bg/state", { cache: "no-store" });
					if (!res.ok) return;
					const payload = await res.json();
					const enabled = payload.state?.slideshow?.enabled === true;
					const seconds = Math.max(1, Math.round(payload.state?.slideshow?.seconds ?? 60));
					const itemsKey = (payload.gallery?.items ?? []).map((i) => i.name).join("|");
					const cfg = JSON.stringify([
						enabled,
						seconds,
						itemsKey
					]);
					if (cfg === lastConfig) return;
					lastConfig = cfg;
					if (timer !== void 0) {
						clearInterval(timer);
						timer = void 0;
					}
					if (enabled && (payload.gallery?.items?.length ?? 0) >= 2) timer = window.setInterval(() => {
						run(advance);
					}, seconds * 1e3);
				};
				run(sync);
				poll = window.setInterval(() => {
					run(sync);
				}, CONFIG_POLL_MS);
				return () => {
					disposed = true;
					if (poll !== void 0) clearInterval(poll);
					if (timer !== void 0) clearInterval(timer);
				};
			}, "dsh-background: slideshow");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map