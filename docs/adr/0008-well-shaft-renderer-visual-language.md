---
title: ADR-0008 Well-Shaft Renderer Visual Language
type: decision
status: accepted
adr_id: "0008"
repo: topweedev/tetris-XL
path: docs/adr/0008-well-shaft-renderer-visual-language.md
tags: [adr, tetris-xl, renderer, visual, three-js, well-shaft, mockup, a11y]
---

# ADR-0008: Well-Shaft Renderer 視覺語言（Layer 1 全域規則 + Layer 2 Piece 視覺）

- 狀態：Accepted（rev.4 — human accept 2026-07-25；三 reviewer 齊過 LA4/LA6/LA7；rev.3.1 收斂 all-nit；rev.3 依 LA6+LA7 round 1；rev.2 依 LA4 round 1；rev.1 draft）
- 日期：2026-07-25
- 決策者：LA1 起草，待人類 + review agents (LA6 round 2 / LA7 round 2) 確認
- 相關文件：
  - ADR-0001 §2.5（渲染策略、相機 20° pitch 預設、井壁 renderOrder 分層、單一 `InstancedMesh`）
  - ADR-0001 §2.2–2.4、§2.4.2（碰撞規則、HardDrop 語意 — ghost 落點高度推導來源）
  - ADR-0001 §2.4.3（top-out / game over 條件）
  - ADR-0002 §2.1（12 種 canonical polycube 定義）
  - ADR-0004（keymap；本 ADR §5 引用作為 a11y 對接參考）
  - ADR-0007 rev.3（React + Tailwind UI 疊層，M4 已觸發；本 ADR §5 引用作為 ARIA live region 出口）
  - Brain: `oab/design/tetris-xl-well-shaft`（LA8 mockup 完整脈絡）
  - Brain: `oab/design/well-visibility-comparison`（井壁 A/B/C，待人類另派 LA8 出 mockup）
  - Brain: `oab/design/top-down-z-view`（近垂直俯視替代方案 + Z-height ruler + contact frame，本 ADR §5 引用為 depth ruler 設計來源）
  - Brain: `oab/design/piece-catalog`（12 種 polycube 視覺目錄）
  - Brain: `oab/pr/adr-0008-review-la4` / `-la4-r2`（LA4 rounds 1 & 2）
  - Brain: `oab/pr/adr-0008-review-la6`（LA6 round 1）
  - Brain: `oab/pr/adr-0008-review-la7`（LA7 round 1）
  - Mockup artifacts (branch `design/tetris-xl-well-shaft` @ `e439844`)：
    - `design-prototypes/tetris-xl/tetris-xl-empty-well/index.html`
    - `design-prototypes/tetris-xl/tetris-xl-well-shaft/index.html`

## 1. 背景 (Context)

LA8 於 2026-07-25 交付一組井道 + 方塊視覺 mockup（人類在 delivery thread 直接 dispatch，非 LA1 派工）。三張 mockup 分別驗證：

1. **空井道** — 井道本體、depth ring、tilt 視角，無方塊。
2. **方塊堆疊** — Z=0 底層 O4/L4/I3 填滿；Z=1 疊 O + L(90°)；Z=10 active L；ghost 投影 hard-drop 落點。
3. **Active cell 格線加亮** — 同 2，但 active piece 每格 cell 格線加亮到 70% opacity / 0.8 px。

人類 2026-07-25 16:41 CST 明確指示：mockup 內含的視覺規則要**拆兩層記**、避免未來 renderer 實作把整包吃成單一 spec：

- **Layer 1（Renderer 全域規則）**：井道 / 透視 / 縮放公式 / depth ring — 屬 renderer 對整個場景的表現。
- **Layer 2（Piece / interaction 視覺）**：active / ghost / locked / 警戒高度 — 屬玩家操作方塊本身的視覺與狀態表達。

本 ADR 把 LA8 mockup 的視覺參數正式化為兩層規範，作為 M4 renderer 實作的視覺基準。**井壁 A/B/C 方案**（`oab/design/well-visibility-comparison`）延後，等人類另派 LA8 補 mockup 後另立 ADR 或 amend 本 ADR。

## 2. 決策 (Decision)

### 2.1 定位與適用範圍

本 ADR **只涵蓋視覺表現層**，不涉及：

- 遊戲邏輯（座標系、碰撞、FSM — 見 ADR-0001 §2.2–2.4）
- Piece 定義（12 種 polycube — 見 ADR-0002 §2.1；ADR-0008 只規範呈現方式）
- Renderer 資料結構 / draw call 策略（`InstancedMesh` 等 — 見 ADR-0001 §2.5）

**與 ADR-0001 §2.5 的關係（delta 標記）**：ADR-0001 §2.5 定義兩相機模式：預設 ~20° pitch、alt 為「純垂直俯視」（0°）。本 ADR 引入的 `-5°` tilt 屬 **near-vertical top-down（0° ± small tilt）家族**，嚴格說**不是純 0°**，因此對 §2.5 alt mode 有語意擴張。本 ADR 目前將 `-5°` 視為 §2.5 alt mode 的**具體規範**，並在 §5 列出「amend ADR-0001 §2.5 alt mode 表述為 near-vertical top-down 家族」為 follow-up，避免 ADR-0008 單方面擴張上游 ADR 的語意。**本 ADR 不變更 §2.5 的預設 20°**；若人類後續決定 `-5°` 取代 20° 為預設，另發 amendment。

### 2.2 Layer 1 — Renderer 全域規則

#### 2.2.1 視角與投影 (Camera / Projection)

- **Tilt**：`rotateX(-5°)`，near-vertical（幾乎純俯視）。
- **透視性質**：**非物理透視**（non-physical projection）。mockup 使用 CSS `perspective(2400px)` 作為外框視覺投影 hint，但井道深度縮放採獨立公式（見 §2.2.2），不對應真 3D 相機投影矩陣。
- **實作建議路徑**：
  - `OrthographicCamera` + 將 `s(z)` 烘焙進每個 instance 的 `instanceMatrix`（locked cells InstancedMesh；per-instance scale 由 CPU 端在初始化 / 每次修改場地時 set）。
  - Active piece `Group` 以 per-cell matrix 套用同一 `s(z)`。
  - 上述兩者與 ADR-0001 §2.5「單一 `InstancedMesh`」相容，**不需**多 InstancedMesh。
  - **WebGL upload 機制**：`InstancedMesh.setMatrixAt(i, m)` → `instanceMatrix.needsUpdate = true` → three.js 於下一幀以 `gl.bufferSubData` 單次上傳（**每 instance 一個 4×4 matrix = Float32 × 16 = 64 B；300 instances ≈ 19.2 KB 單次 upload**）。因此**觸發時機建議限於「場地變動」（locked 新增 / 消除 / 落層）**，非每 tick，避免 per-frame 上傳。
- **不建議路徑**：
  - `PerspectiveCamera` + 手動 override cell scale：與相機投影矩陣衝突。
  - 直接依賴 `PerspectiveCamera` 內建投影：無法匹配 mockup 的 8×/1× 縮放比例。

#### 2.2.2 井道縮放公式（非物理 scale）

- **公式**：`s(z) = 1 + (z/DEPTH)² × 7`，其中 `DEPTH = 12`（等於 board Z 深度，見 ADR-0001 §2.2；若未來 board Z 深度變更，本公式分母須同步以 `DEPTH` 常數 rebind，非 hardcode）。
- **邊界值**（實作驗證用，以 `DEPTH = 12` 計）：
  - `s(0) = 1`（井底 1×）
  - `s(10) ≈ 5.86`（Z=10 警戒 depth ring 的 scale，交叉參考 §2.2.3）
  - `s(11) ≈ 6.88`（Z=11 井口內側）
  - `s(12) = 8`（井口外緣 rim，僅用於井道外框繪製）
- **曲率**：二次曲線 — 低層幾乎不動、高層大幅放大。設計意圖：讓玩家近落點（低層）比例穩定、遠端（高層）視覺放大以便看清 active piece 全貌。
- **Y 垂直偏移**：每層額外 `-z × Δy` 上移（`Δy` 為 world unit；初值取 ≈ 1 / (cell size)，實作期 tune；對應 mockup 的 `1 px` 視覺）。與 `s(z)` 一併套用，順序：先 scale cell size，再套 offset。**高 DPR 保證**：M4 實作端需驗證 `Δy` 投影到螢幕後 ≥ 1 CSS px（見 §4.5），否則層間視差消失。

#### 2.2.3 Depth Ring（深度環）

- 井道深度分 12 層。**實際 ring 分布**：
  - `z = 0`（floor）：**無 ring**（實心井底）。
  - `z = 1…11`（**共 11 圈**）：常規 depth ring；透過 §2.2.2 公式 `s(z)` 縮放（`s(1) ≈ 1.05` … `s(11) ≈ 6.88`）。
  - `z = 12`（rim-top）：**外緣 rim**，`s(12) = 8`，屬井口外框，非 depth ring 之一。
  - **總繪製線數 = 11 rings + rim-top + floor 描邊 = 13 個線元素**。
- **警戒高度 `Z=10`**：以**紅色 + 非顏色 cue 複合訊號** 標示：
  - **顏色**：紅色 ring。
  - **非顏色 cue**：**dashed pattern**（相對於其他 depth ring 的實線）+ **持續脈衝亮度**（可選；**頻率上限 ≤ 3 Hz 且採 smooth ramp**（WCAG 2.3.1 Three Flashes or Below Threshold），需支援 `prefers-reduced-motion: reduce` 完全關閉）+ **DOM overlay 警戒 badge**（見 §5 a11y 對接 ADR-0007）。三者中至少 dashed pattern 為必備，其他為建議。
  - **對比度**：紅色與井道背景的 WCAG 1.4.11 對比 **≥ 3:1**（mockup 的 `rgba(255,102,125,.45)` 疊暗背景後為 ~2.18:1，**不合格**，實作需調高 opacity 或改色使實際對比 ≥ 3:1）。
  - **軟警戒性質** — 非 game over 觸發線；game over 觸發條件見 ADR-0001 §2.4.3（spawn blocked 或 `z > 11` above-ceiling lock）。
- **RenderOrder（Layer 1 全 ring 一致）**：`renderOrder = 0`（與井壁同層）；ring **不得** 遮擋 `renderOrder ≥ 1` 的 locked cell。實作端須確保 depth-write / z-fighting 不產生 ring 剪切 locked 的情況（若必要，關閉 ring 的 `depthWrite`）。
- Ring 樣式：非填充、線框（1 CSS px `--rim-soft` 為預設，high-DPR 時依 `devicePixelRatio` 保持 ≥ 1 CSS px），依 §2.2.2 公式 `s(z)` 縮放。

#### 2.2.4 井壁

- **狀態**：**已定案於 ADR-0009**（rev.2.1，2026-07-28 accepted）。方案 C（近端深度淡化 / depth-fade）由 ADR-0009 §2.2 規範，取代原 rev.1–rev.4「暫用透明井壁 + 未定案」表述。
- **本 ADR 保留 renderOrder 語意**：井壁層仍為 `0`（不遮 locked）；depth ring 屬同層，depth-fade 對 ring 可見性影響由 ADR-0009 §2.3 規範。
- **本 ADR 不 mandate 井壁材質實作細節**（fade 公式、`zWallNear` anchor、`FADE_NEAR_OFFSET / FADE_FAR_OFFSET`、segment count 等）皆由 ADR-0009 §2.2 / §2.4 擁有；若 ADR-0009 未來 amend 井壁方案，不需回改本 ADR。

### 2.3 Layer 2 — Piece / Interaction 視覺

#### 2.3.1 繪法基礎（three.js 用語）

本節同時記載 mockup（SVG / CSS）與 three.js 對應詞彙，M4 implementer 以 **three.js 詞彙為權威**：

| 概念 | Mockup 詞彙（SVG） | three.js 對應 |
|------|---------------------|----------------|
| 描邊輪廓 | `<path>` outline | `EdgesGeometry` / `LineSegments`（或自訂 `BufferGeometry`） |
| 消共享邊 | `edgeMap` 相鄰 cell 邊去重 | 自建 edge set（`EdgesGeometry` 的 threshold 判定不符時，自建 edge index buffer） |
| Winding | CCW（path direction） | Geometry vertex order；影響 backface culling / normal 方向。**與 SVG `fill-rule`（nonzero / evenodd）無關** |
| Cell center 投影 | 從 grid 中心 `(40, 40)` 向外 scale | 從 board 中心（world origin XY）向外 scale；`(40, 40)` 為 mockup 硬編碼像素座標，實作時以 board 中心為原點 |
| Y 垂直偏移 | `-z × 1 px` | `-z × Δy`（world unit，見 §2.2.2） |

- **Piece 幾何定義**：座標來源同 ADR-0002 §2.1 canonical 12 polycube（`src/engine/pieces/definitions.ts`）。本 ADR **不重複定義 piece 幾何**，只規範**呈現方式**。

#### 2.3.2 狀態視覺對應

| 狀態 | 線框 | 填色 | Cell 格線 | 備註 |
|------|------|------|-----------|------|
| **Active**（玩家控制中） | **`activeOutlineColor`（mockup 值 cyan `#39e6cf`；tunable，見 §2.4）** 1 CSS px；`prefers-reduced-motion` 下**無**脈衝，否則可選 subtle glow | 透明 | 每格 70% opacity / 0.8 CSS px | 顯示 piece 形狀與朝向 |
| **Ghost**（落點預覽） | **白色虛線 dashed，線寬 1 CSS px**，dash pattern 與 depth ring warning 有明顯**差異**（建議 dash `[6, 4]` vs warning `[3, 3]`；且 ghost **可選** subtle glow 標示，防與 Z=10 danger ring / locked white grid 混淆） | 無 | 無 | 投影於 **hard-drop 落點高度**（變動 z，依堆疊高度；落點由 ADR-0001 §2.2–2.4 碰撞規則 + §2.4.2 HardDrop 語意推導）；不干擾實體視覺 |
| **Locked**（已鎖定） | 無額外描邊（fill 邊即輪廓） | 實心（依 typeId 配色 + **§2.3.3 非顏色冗餘 pattern**） | **白色 cell 格線 mockup 值 15% opacity / 0.5 CSS px（tunable）；實作時 opacity 與 fill 對比須 ≥ 3:1，否則提高 opacity 或改用 dark stroke** | 每格 cell 需清楚可見以助掃描；opacity 影響 fill rate（見 §4.4） |
| **警戒高度標記**（`Z=10`） | 紅色 dashed depth ring（Layer 1） | — | — | 屬 Layer 1；此列為交叉參考；soft warning，非 top-out 觸發（§2.2.3）；**須 dashed + non-color cue** 複合訊號 |

- **RenderOrder 交叉表**（延伸 ADR-0001 §2.5）：
  - `0` — 井壁 + depth ring + warning ring
  - `1` — Locked InstancedMesh
  - `2` — Ghost
  - `3` — Active
  - 警戒 ring 屬 `0`，**不遮** locked（`1`），避免 ring 剪擋堆疊資訊。

#### 2.3.3 顏色 / 可讀性不變式（非顏色冗餘 mandate）

- **顏色不是唯一識別**（WCAG 2.1 §1.4.1 Use of Color）：每個 **locked cell/piece** 必須帶**非顏色識別訊號**，至少下列之一：
  - **Pattern / hatching**（每 typeId 一種）
  - **Type ID glyph**（在 cell 上疊一小字元 / icon）
  - **經 CVD 測試證明的 silhouette invariance**（3D outline 在色弱下仍可辨；因 `-5°` near-vertical view 對非平面 polycube (RS4/LS4/BR4) 的 silhouette 會退化為 2D 面積，**silhouette 單獨不足**，須配合 pattern 或 glyph）
- **Active outline 色 vs Locked palette**：`activeOutlineColor` **不得與 locked palette 中任一色重疊**（mockup 目前 cyan `#39e6cf` 同時是 locked I3 之一，違規；M4 實作階段須改配色，Locked palette 由 `oab/design/piece-catalog` + 後續 LA8 palette review 決定）。
- **顏色距離下限**：Locked palette 兩兩配色之 CVD 距離（Machado et al. 2009 dichromacy matrices）於 deuteranopia / protanopia / tritanopia 三態下**每對 ≥ 0.3**（**距離定義**：兩色先套 Machado 矩陣模擬 CVD，取 linear RGB clamp `[0, 1]`，再取 Euclidean distance `sqrt((ΔR)² + (ΔG)² + (ΔB)²)`）；不足者須另配色或依上文 pattern/glyph 補救。**注意**：`≥ 0.3` 為 project floor 快篩，**不能取代** pattern/glyph 冗餘；三色盲下部分邊界對即使 ≥ 0.3 仍需 pattern 保證識別（LA7 建議條件寫成「pair ≥ 0.3 OR distinct pattern/glyph」）。
- **對比度**：所有 outline / grid / warning 對其**背景 + 相鄰元素**的 WCAG 1.4.11 對比 **≥ 3:1**（M4 CVD/contrast automated check 為 accept criteria）。
- **Ghost vs Active** 主要差異：dash pattern（虛線 vs 實線）+ fill（空 vs 半透明）+ dash pattern 與 warning ring 差異化。
- **Active vs Locked** 主要差異：outline stroke（非 locked palette 色 1 px vs 無/fill 邊）+ fill（透明 vs 實心 + pattern）。

### 2.4 開放參數 (Tunables)

以下數值**於本 ADR 記錄為 mockup 選定值 / 初值**，實作階段允許人類 / 設計 iterate，不需重發 ADR：

- Tilt 角度：`-5°`（如需比較 `0°` / `-3°` / `-8°` 等，記入 `oab/design/top-down-z-view`）
- Scale 曲線常數：`(z/DEPTH)² × 7`（若視覺不佳可調整二次係數或曲率；`DEPTH` 綁定 board Z 深度）
- Y 垂直偏移常數 `Δy`（world unit；初值 ≈ 1 / cell size；須 ≥ 1 CSS px 高 DPR floor）
- Depth ring 顏色 / 線寬（1 CSS px 為 floor）
- Warning ring dash pattern（建議 `[3, 3]`）、脈衝亮度（reduced-motion 下關閉）
- **Active outline 色 `activeOutlineColor`**（初值 mockup `#39e6cf`；**必需**不與 locked palette 重疊）
- **Locked cell 格線 opacity / 線寬**（初值 15% / 0.5 CSS px；**必需**對 fill 對比 ≥ 3:1）
- Active cell 格線 opacity / 線寬（初值 70% / 0.8 CSS px）
- Ghost dash pattern（建議 `[6, 4]`）
- Locked palette per typeId（來自 `oab/design/piece-catalog`；M4 palette review 前為暫定）
- Locked 非顏色 pattern per typeId（來自 §5 follow-up LA8 設計）

**閉合參數**（改動需 amend 本 ADR）：

- 兩層拆分本身（Layer 1 / Layer 2）
- 非物理 scale 的**本質**（若改為真 3D perspective camera，屬結構變更，見 §4.5 升級成本）
- Ghost 投影至 **hard-drop 落點高度**（非其他呈現，如 fixed z / trajectory line）
- Active/Ghost/Locked 三態存在與功能定位
- Depth ring 分布（11 rings + rim-top + floor）
- RenderOrder 分層（延伸 ADR-0001 §2.5 taxonomy：warning ring 屬 wall 層 0）
- WCAG a11y 不變式（1.4.1 非顏色冗餘、1.4.11 對比 3:1）
- Locked palette 之 CVD 距離下限（≥ 0.3）

**井壁相關 tunables 讓渡給 ADR-0009**（rev.5 sync amend, 2026-07-28）：

- 井壁方案本身（option C = near-Z depth fade）為 ADR-0008 閉合、由 ADR-0009 具現化。改用其他方案需同時 amend 本 ADR §2.2.4 + ADR-0009。
- 井壁 depth-fade 公式、`zWallNear` anchor、`FADE_NEAR_OFFSET / FADE_FAR_OFFSET`、segment count、preset 切換、context restore 策略等**由 ADR-0009 §2.2 / §2.4 擁有**，本 ADR 不再列為 tunable。改動只需 amend ADR-0009。

## 3. 已考慮的替代方案 (Alternatives Considered)

### 3.1 純 3D perspective camera（three.js `PerspectiveCamera`）

- **優點**：光學物理一致、實作直接、未來若加自由視角轉場容易；VR / 頭追 head-tracking 天然相容。
- **缺點**：井口 8× / 井底 1× 這種戲劇化縮放需極端 FOV 或極近相機，會導致 UI 座標對應困難、低層 cell 過小無法辨識。
- **裁決**：拒絕作 MVP 預設；保留為未來升級選項（見 §4.5、§5 後續行動）。

### 3.2 純垂直俯視（`0°` tilt / top-down）

- **優點**：完全消除 Z 軸壓縮視覺誤判；與 `oab/design/top-down-z-view` 3° 微傾同一家族；VIMS 風險最低。
- **缺點**：失去井道空間感，玩家難以直覺感知「深度」與 active piece 高度；需靠額外 HUD ruler。
- **裁決**：拒絕作預設；**列為 accessibility toggle 候選（見 §5）**，配合 depth ruler / contact frame。

### 3.3 ADR-0001 §2.5 預設 20° pitch

- **優點**：現行 accepted ADR、無 delta。
- **缺點**：井道透視強、5×5 井底單元格在遠端變形嚴重；不符合玩家「井中投擲」的空間隱喻；LA7 未評估 VIMS 但預期較 `-5°` 高。
- **裁決**：**不取代**，本 ADR 屬 §2.5 alt mode 的具體規範（並帶 §2.5 語意擴張為「near-vertical 家族」的 follow-up，見 §2.1 與 §5）；預設由誰擔任待後續 usability review。

### 3.4 單一 ADR 混合 Layer 1 + Layer 2 vs 拆兩份 ADR

- **考量**：Layer 1 屬 renderer 全域、Layer 2 屬 piece / interaction，未來 iterate 頻率可能不同（Layer 2 可能因 accessibility 頻繁調整；Layer 1 相對穩定）。
- **裁決**：**本 ADR 內部分兩節**（§2.2、§2.3），保留未來拆兩份 ADR 的空間（若 Layer 2 iterate 頻率確實高於 Layer 1，可從本 ADR 分出 ADR-0008a / 0008b 或另編號）。

## 4. 影響 (Consequences)

### 4.1 對 M4 Renderer 實作

- Renderer 需引入自訂 per-instance scale 邏輯（將 §2.2.2 `s(z)` 烘焙進 `instanceMatrix`），複雜度略增。
- 已鎖定 `InstancedMesh`（ADR-0001 §2.5「單一 `InstancedMesh`」）需與 §2.2.2 scale 相容。**建議路徑**：把 `s(z)` 烘焙進 `instanceMatrix`（per-instance scale）或在 vertex shader 內以 `z` 施加 scale，兩者**皆維持單一 InstancedMesh**、不觸發 §2.5 amendment。**若**實作改採「每層一個 InstancedMesh」（12 個），屬 ADR-0001 §2.5 delta，需另發 amendment。
- **`instanceMatrix` upload**：預期在「locked 新增 / 消除 / 落層」時 dirty 整段（19.2 KB `bufferSubData`）；非每 tick 更新（見 §2.2.1 WebGL 上傳機制）。
- **Ghost 落點運算**：落點高度由碰撞規則（ADR-0001 §2.2–2.4）+ HardDrop 語意（ADR-0001 §2.4.2）推導；顯示樣式見 ADR-0001 §2.5 + 本 ADR §2.3。**不引用** ADR-0004 §2.4（ADR-0004 §2.4 為 Spike 期鍵位映射，非 ghost 定義）。

### 4.2 對 ADR-0001 §2.5 renderOrder 分層

- §2.5 定義 renderOrder：井壁 0 / locked 1 / ghost 2 / active 3。本 ADR **延伸**：depth ring (含 Z=10 warning) 一併屬 `0`（與井壁同層），不遮 `≥ 1`（見 §2.2.3、§2.3.2 renderOrder 交叉表）。
- 井壁 renderOrder 語意在井壁 A/B/C 決策落地前保留（暫定透明壁 + depth ring 屬井壁 renderOrder 0 的實例）。

### 4.3 對 ADR-0007（UI 疊層）

- UI 疊層（HUD、選單）仍屬 React + Tailwind DOM overlay（ADR-0007 rev.3），本 ADR 不涉及。
- **但**：depth ring 警戒 `Z=10` 的紅色**主要**是**井道場景元素**（canvas 內），不進 DOM overlay，避免 z-index 錯位；**輔助**警戒 badge / ARIA live region 走 ADR-0007 DOM overlay（見 §5 a11y 對接）。

### 4.4 對效能 (Performance)

- 二次 scale + per-instance offset：若採 shader 內計算或 CPU 端烘焙 `instanceMatrix`，成本可忽略；若採 CPU 端每 tick 重算並改 mesh transform，需 profile。**建議路徑**是「初始化 / 場地變動時更新 `instanceMatrix`，非每 tick」，upload 量 ~19.2 KB / 事件。
- **Depth ring 13 元素**（11 rings + rim-top + floor）：`LineSegments` 或 `EdgesGeometry` 皆足夠；LA6 估 ~2 draw calls（可 batch），不進 InstancedMesh。
- **Cell 格線 alpha overdraw**（LA6 S2 hotspot）：
  - Locked 300 cells 各繪白色 cell 格線 opacity 15% / 0.5 CSS px；每 cell 6 面 × 4 edge = 24 edges；**總 ~2400 alpha-blended line vertices**。
  - Active piece（最多 4 cell）疊加 70% opacity / 0.8 CSS px cell 格線 —— overdraw 主要來源。
  - **極端情境 profile 目標**：4K DPR2、mid-Z（`s(z) ≈ 3–5`）場景，estimated ~115K px alpha-blended per frame。fill rate 屬中等；M4 須 profile 確認 60 FPS 不掉幀（見 §5 M4 verification）。
  - **對策候選**（實作決定）：locked 格線降至更低 opacity 或改 solid dark stroke（維持 §2.3.3 對比 3:1 為前提）、locked 格線 disable on high-Z（`s > 4`）以省 fill rate。

### 4.5 未決風險與 M4 verification 條款

- **1 CSS px active outline / 0.8 CSS px cell 格線 / `Δy` world offset**：所有線寬 / offset **投影到螢幕 ≥ 1 CSS px**（`devicePixelRatio` 縮放友善）。M4 accept criteria：pixel test on `dpr = 1 / 1.5 / 2 / 3`，viewport 從 mobile 到 4K。
- **非物理 scale**：與未來若接入 mobile pinch-zoom 的相容性 —— **低成本 degradable**（限制 zoom 範圍，non-physical scale 仍生效，僅視窗尺寸變化）；接入 VR head-tracking —— **高成本 degradable**（VR 天然物理 perspective，須拔除 baked `s(z)`，改真 3D `PerspectiveCamera`；等同 §3.1 refactor path）。
- **升級真 3D perspective**（若未來人類決定切換）：
  - Renderer 層 refactor 估 **1–2 人天**（LA6 估算）：改相機、拔除 `instanceMatrix` bake、shader 端 scale 邏輯改為 uniform matrix；ghost / warning ring / cell 格線邏輯不受影響。
  - Data model（board / piece / FSM）**不受影響**。
  - `§2.4` 閉合參數「非物理 scale 本質」須 amend。
- **井壁 A/B/C 未定**，實作階段以透明壁 + depth ring 佔位，切換時需保留 renderOrder 語意。
- **A11y 風險（LA7 領域，M4 verification 條款）**：
  - **CVD**（deuteranopia / protanopia / tritanopia）：M4 需以 Machado 2009 matrices 對 locked palette 兩兩驗證距離 ≥ 0.3，active outline 不落 locked palette。
  - **WCAG 1.4.11 對比**：所有 outline / grid / warning 對背景與相鄰元素 ≥ 3:1。
  - **DPR 可視性**：見上文 pixel test。
  - **VIMS / 動暈**：`-5°` tilt + 二次 scale 未評估；M4 前段須做 vestibular-sensitive playtest（見 §5）。
  - **深度誤判 / ghost 高度**：若啟用 depth ruler / contact frame（§5 toggles），M4 須驗證其對 ghost 高度判斷的**有效性**（例：受測者能否在 ghost 低 z 1× vs active 高 z 5.86× 時正確估計相對高度），以確認冗餘訊號真的緩解 LA7 S2 深度誤判風險。

## 5. 後續行動 (Follow-ups)

**Cross-ADR**：

- **Amend ADR-0001 §2.5 alt mode 表述**：將「純垂直俯視」擴張為「near-vertical top-down 家族（0° ± 小傾角）」，並 reference 本 ADR 為 `-5°` 具體規範。此 amendment 建議與 ADR-0008 accept 同步發，避免 ADR-0008 accept 後 §2.5 語意仍舊。

**Design（人類另派 LA8 in `#design-lab`）**：

- **井壁 A / B / C mockup** — **CLOSED**（rev.5 sync amend）：方案 C（近端深度淡化 / depth-fade）由 ADR-0009 rev.2.1 具現化並 accepted 於 2026-07-28。§2.2.4 已同步更新，指向 ADR-0009 §2.2 / §2.4。
- **Locked palette review**：確保 §2.3.3 CVD 距離 ≥ 0.3、且 `activeOutlineColor` 不在 palette 內；如現行 `#39e6cf` 為 locked I3 用色即需替換。
- **Locked 非顏色 pattern / hatching / glyph per typeId** 設計（滿足 §2.3.3 mandate）；建議借鑒 `oab/design/piece-catalog` 現有 typeId ID / silhouette 語彙。
- **Warning cue 設計**：Z=10 red ring 之外的非顏色 cue（dashed 已定為 baseline，加成 pulse animation 與 DOM overlay badge 由 LA8 設計）。
- **Mobile responsive**：目前 mockup 僅 desktop；mobile 版本另派 LA8。

**M4 Renderer 實作 verification（accept criteria for ADR-0008 accepted → M4 exit）**：

- **A11y automated check**：
  - Locked palette CVD pairwise distance ≥ 0.3（Machado 2009 matrices，三色盲態）。
  - `activeOutlineColor` 不在 locked palette 內。
  - Outline / grid / warning WCAG 1.4.11 對比 ≥ 3:1（對背景與相鄰元素）。
- **DPR pixel test**：`dpr ∈ {1, 1.5, 2, 3}` × viewport ∈ {mobile 375, tablet 768, desktop 1440, 4K 3840} 下所有線寬 / `Δy` ≥ 1 CSS px。
- **Fill rate profiling**：4K DPR2 mid-Z 場景 60 FPS 不掉幀。若 locked 格線 alpha overdraw 為瓶頸，套用 §4.4 對策候選。
- **CVD manual playtest**：至少一位 deuteranope + 一位 protanope 玩家試玩 M4 preview。
- **VIMS / 動暈 playtest**：**vestibular-sensitive 玩家**試玩，若不適 → 啟用 §5 reduced-motion / top-down toggle。

**Accessibility toggles（M4 UI 疊層須實作，走 ADR-0007）**：

- `prefers-reduced-motion`：停用 warning ring pulse、active outline glow、camera easing。
- **相機切換**：`-5°` near-vertical ↔ **純垂直俯視** (`0°`)（參 `oab/design/top-down-z-view`，含 Z-height ruler + orange contact frame）。
- **Depth ruler / contact frame**：主要為 near-vertical mode 之補助（見 S2 深度誤判），可視為 §3.2 top-down 模式的預設。
- **CVD 模式**：可選（若 palette CVD 距離已達標則不強制）。
- **A11y tree（screen reader）**：canvas 內狀態（active z、ghost z、warning、next、hold）透過 **ADR-0007 DOM overlay + ARIA live region** 傳遞（滿足 WCAG 2.1.1 Keyboard、1.3.1 Info and Relationships、4.1.2 Name/Role/Value、4.1.3 Status Messages）。**鍵盤操作走 ADR-0004 keymap**，不重複規範。

**Review 收尾**：

- LA6 round 2 verify rev.3（1 S-B + 4 S + 1 N 是否解決）。
- LA7 round 2 verify rev.3（2 B + 5 S + 1 N 是否解決）。
- LA4 已 REVIEW_OK；除非新一輪 findings 觸及 correctness / tech-stack，否則不需 round 3。

## 6. 修訂紀錄 (Revision History)

- **rev.1（2026-07-25，draft）** — LA1 首版草稿；依 brain `oab/design/tetris-xl-well-shaft` (page 180) 與 mockup HTML `design/tetris-xl-well-shaft@e439844` 交叉核對 tilt/scale/cell 規則。狀態 `proposed`。
- **rev.2（2026-07-25）** — 依 LA4 round 1 review (`oab/pr/adr-0008-review-la4`) 修正：
  - B1：§2.2.2 修正 `s(11)` 邊界值為 `≈6.88`；新增 `s(10) ≈ 5.86` 明確標為 Z=10 警戒 ring scale。
  - B2：§2.3.2 表格 Ghost 列 + §2.4 閉合參數 —— 從「投影至 `Z=0`」改為「投影至 hard-drop 落點高度（變動 z）」。
  - S1：§2.1 加入 §2.5 delta 標記 + §5 amend ADR-0001 §2.5 follow-up。
  - S2：§2.2.1 建議實作路徑改為「`OrthographicCamera` + `instanceMatrix` 烘焙 `s(z)`」為主。
  - S3：§2.3.1 改用 three.js 詞彙表述，SVG 為對照。
  - S4：§4.1 單一 InstancedMesh 相容路徑澄清；多 mesh 需 §2.5 amendment。
  - S5：§4.1 移除 ADR-0004 §2.4 錯引；ghost 落點運算改引 ADR-0001 §2.2–2.4 + §2.4.2。
  - S6：§2.2.2 Y offset 單位改為 world unit `Δy`。
  - N1：§2.2.3 補充 Z=10 紅環為 soft warning + 交叉參考 ADR-0001 §2.4.3。
  - N2：§2.3.1 對照表明確區分 winding 與 SVG `fill-rule`。
- **rev.3（2026-07-25）** — 依 LA6 round 1 review (`oab/pr/adr-0008-review-la6`) + LA7 round 1 review (`oab/pr/adr-0008-review-la7`) 修正：
  - LA6 S-B1：§2.2.3 / §4.4 depth ring 分布改為「11 rings (z=1–11) + rim-top (z=12) + floor (z=0 無 ring) = 13 元素」。
  - LA6 S1：§2.3.2 / §2.4 加入 locked cell 格線 opacity spec（初值 mockup 15% / 0.5 CSS px，tunable，須對 fill 對比 ≥ 3:1）。
  - LA6 S2：§4.4 補 locked 格線 alpha overdraw hotspot 分析（~2400 verts / ~115K px 4K DPR2 mid-Z，M4 profile）+ 對策候選。
  - LA6 S3：§2.2.1 補 WebGL upload 機制（`setMatrixAt → needsUpdate → bufferSubData 19.2 KB`，per-event 非 per-tick）。
  - LA6 S4：§4.5 補真 3D perspective refactor 成本估算（1–2 人天，data model 不受影響）。
  - LA6 S5：§4.5 區分 mobile pinch-zoom（低成本）vs VR head-tracking（高成本）degradability。
  - LA6 N1：§2.2.2 / §2.4 formula 分母 `12` 改為 `DEPTH` 常數，綁定 board Z 深度。
  - LA7 B1：§2.3.3 mandate 非顏色冗餘（pattern / glyph / silhouette invariance，需配合 pattern 因 near-vertical view 對 non-planar polycube silhouette 退化）；補 CVD 距離下限 ≥ 0.3；`activeOutlineColor` 不得與 locked palette 重疊；M4 automated check accept criteria。
  - LA7 B2：§2.2.3 warning ring 改為紅色 + non-color cue 複合（dashed baseline + optional pulse w/ reduced-motion off + DOM overlay badge）；WCAG 1.4.11 對比 ≥ 3:1 mandate。
  - LA7 S1：§5 accessibility toggles 加入 `prefers-reduced-motion` + top-down 相機切換；M4 verification 加入 VIMS playtest。
  - LA7 S2：§5 加入 depth ruler / contact frame（參 `oab/design/top-down-z-view`）以緩解深度誤判；§4.5 未另列獨立 verify item（於 rev.3.1 補上）。
  - LA7 S3：§2.2.2 / §2.3.2 / §2.3.3 高 DPR pixel test 條款；§4.5 M4 accept criteria pixel test dpr × viewport 矩陣。
  - LA7 S4：§2.2.3 / §2.3.2 renderOrder 交叉表（warning ring 屬 wall 層 0，不遮 locked）；ghost dash `[6, 4]` vs warning dash `[3, 3]` 差異化。
  - LA7 S5：§5 a11y tree via ADR-0007 DOM overlay + ARIA live region；鍵盤走 ADR-0004。
  - LA7 N1：§2.3.2 active outline 色名改用 `activeOutlineColor` tunable（mockup 值 cyan `#39e6cf`）；§2.4 補「不得與 locked palette 重疊」規則。
- **rev.3.1（2026-07-25）** — 依 LA6 round 2 REVIEW_OK（1 nit）+ LA7 round 2 REVIEW_OK（3 nits + 1 §6 changelog 更正）收斂，皆非 blocking：
  - LA6 nit（§6 count）：rev.3 狀態行「1 S-B + 4 S + 1 N」更正為「1 S-B + **5** S + 1 N」（S1–S5 共 5 個 Should）。
  - LA7 N1：§2.2.3 warning pulse 補「頻率上限 ≤ 3 Hz + smooth ramp」（WCAG 2.3.1 Three Flashes or Below Threshold）+ `prefers-reduced-motion` 完全關閉。
  - LA7 N2：§2.3.3 CVD 距離 metric 補精確定義（Machado 矩陣 → linear RGB clamp `[0, 1]` → Euclidean distance）；並補 note「`≥ 0.3` 為 project floor 快篩，不能取代 pattern/glyph 冗餘」。
  - LA7 N3：§4.5 a11y M4 verification 新增「深度誤判 / ghost 高度」verify item（驗 depth ruler / contact frame 對 ghost 高度判斷的有效性）。
  - LA7 §6 S2 wording：更正「§4.5 flag 深度誤判為 M4 verify item」→「§5 depth ruler / contact frame 緩解深度誤判；§4.5 未另列獨立 verify item（於 rev.3.1 補上）」。
- **rev.4（2026-07-25，Accepted）** — 人類 accept 為 accepted status。同 commit 中 sync amend ADR-0001 §2.5 alt-mode 表述為「near-vertical top-down 家族（0° ± 小傾角，具體規範見 ADR-0008）」（ADR-0001 rev.7），滿足 LA4 S1 path (b) sync-amend 約束。三 reviewer 齊過紀錄：LA4 REVIEW_OK (round 1 + 2)、LA6 REVIEW_OK (round 2)、LA7 REVIEW_OK (round 2)。無新內容變更；本 rev 純為 status transition + upstream sync。
- **rev.5（2026-07-28，sync amend）** — ADR-0009 rev.2.1 (`424383f`) accepted 後之 downstream sync amend。無新決策內容；純粹 ownership 讓渡與狀態同步：
  - §2.2.4：井壁狀態從「未定案」改為「已定案於 ADR-0009」（方案 C = near-Z depth fade）；井壁材質實作細節（fade 公式、`zWallNear` anchor、`FADE_NEAR_OFFSET / FADE_FAR_OFFSET`、segment count 等）ownership 讓渡給 ADR-0009 §2.2 / §2.4。
  - §2.4 閉合參數：新增「井壁相關 tunables 讓渡給 ADR-0009」段落，明列本 ADR 已閉合的井壁方案本身 + 讓渡給 ADR-0009 的具體 tunables。
  - §5 follow-up「井壁 A / B / C mockup」標記 CLOSED，指向 ADR-0009。
  - Reviewer：LA4 mini-sanity（correctness / cross-ref）為預設；LA6 / LA7 不需 review（無 perf / a11y 影響，純 pointer 更新）。

