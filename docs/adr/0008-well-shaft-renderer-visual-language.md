---
title: ADR-0008 Well-Shaft Renderer Visual Language
type: decision
status: proposed
adr_id: "0008"
repo: topweedev/tetris-XL
path: docs/adr/0008-well-shaft-renderer-visual-language.md
tags: [adr, tetris-xl, renderer, visual, three-js, well-shaft, mockup]
---

# ADR-0008: Well-Shaft Renderer 視覺語言（Layer 1 全域規則 + Layer 2 Piece 視覺）

- 狀態：Proposed
- 日期：2026-07-25
- 決策者：LA1 起草，待人類 + review agents (LA6 效能 / LA4 正確性 / LA7 安全性) 確認
- 相關文件：
  - ADR-0001 §2.5（渲染策略、相機 20° pitch 預設、井壁 renderOrder 分層）
  - ADR-0007 UI 疊層（React + Tailwind，M4 已觸發）
  - Brain: `oab/design/tetris-xl-well-shaft`（LA8 mockup 完整脈絡）
  - Brain: `oab/design/well-visibility-comparison`（井壁 A/B/C，待人類另派 LA8 出 mockup）
  - Brain: `oab/design/top-down-z-view`（近垂直俯視替代方案，同一 alt mode 家族）
  - Mockup artifacts (branch `design/tetris-xl-well-shaft` @ `e439844`)：
    - `design-prototypes/tetris-xl/tetris-xl-empty-well/index.html`
    - `design-prototypes/tetris-xl/tetris-xl-well-shaft/index.html`

## 1. 背景 (Context)

LA8 於 2026-07-25 交付一組井道 + 方塊視覺 mockup（人類在 delivery thread 直接 dispatch，非 LA1 派工）。三張 mockup 分別驗證：

1. **空井道** — 井道本體、depth ring、tilt 視角，無方塊。
2. **方塊堆疊** — Z=0 底層 O4/L4/I3 填滿；Z=1 疊 O + L(90°)；Z=10 active L；ghost 投影 Z=0。
3. **Active cell 格線加亮** — 同 2，但 active piece 每格 cell 格線加亮到 70% opacity / 0.8px。

人類 2026-07-25 16:41 CST 明確指示：mockup 內含的視覺規則要**拆兩層記**、避免未來 renderer 實作把整包吃成單一 spec：

- **Layer 1（Renderer 全域規則）**：井道 / 透視 / 縮放公式 / depth ring — 屬 renderer 對整個場景的表現。
- **Layer 2（Piece / interaction 視覺）**：active / ghost / locked / 警戒高度 — 屬玩家操作方塊本身的視覺與狀態表達。

本 ADR 把 LA8 mockup 的視覺參數正式化為兩層規範，作為 M4 renderer 實作的視覺基準。**井壁 A/B/C 方案**（`oab/design/well-visibility-comparison`）延後，等人類另派 LA8 補 mockup 後另立 ADR 或 amend 本 ADR。

## 2. 決策 (Decision)

### 2.1 定位與適用範圍

本 ADR **只涵蓋視覺表現層**，不涉及：

- 遊戲邏輯（座標系、碰撞、FSM — 見 ADR-0001 §2.2–2.4）
- Piece 定義（12 種 polycube — 見 ADR-0001 §2.3、ADR-0002 §2.1）
- Renderer 資料結構 / draw call 策略（`InstancedMesh` 等 — 見 ADR-0001 §2.5）

**與 ADR-0001 §2.5 的關係**：ADR-0001 §2.5 定義預設相機為 20° pitch、可切換純垂直俯視。本 ADR 的 `-5°` tilt 屬 §2.5「純垂直俯視」的具體實例（near-vertical 而非嚴格 0°）。**本 ADR 不變更 ADR-0001 §2.5 的預設 20°**；若人類後續決定 `-5°` 取代 20° 為預設，需另發 amendment。

### 2.2 Layer 1 — Renderer 全域規則

#### 2.2.1 視角 (Camera / Projection)

- **Tilt**：`rotateX(-5°)`，near-vertical（幾乎純俯視）。
- **透視性質**：**非物理透視**（non-physical projection）。mockup 使用 CSS `perspective(2400px)` 作為外框視覺投影 hint，但井道深度縮放採獨立公式（見 §2.2.2），不對應真 3D 相機投影矩陣。
- **實作提示**：three.js 端可用 `OrthographicCamera` + 對每層施加自訂 scale（如 §2.2.2），或用 `PerspectiveCamera` 並手動 override cell scale。**不建議** 直接依賴 `PerspectiveCamera` 內建投影，因為結果不會匹配 mockup 的 8×/1× 比例。

#### 2.2.2 井道縮放公式（非物理 scale）

- **公式**：`s(z) = 1 + (z/12)² × 7`，其中 `z ∈ [0, 11]`（層深，`z=0` 井底、`z=11` 井口）。
- **邊界值**：
  - `s(0) = 1`（井底 1×）
  - `s(11) ≈ 5.86`（Z=11 井口內側）
  - `s(12) = 8`（井口外緣 rim，僅用於井道外框繪製）
- **曲率**：二次曲線 — 低層幾乎不動、高層大幅放大。設計意圖：讓玩家近落點（低層）比例穩定、遠端（高層）視覺放大以便看清 active piece 全貌。
- **Y 垂直偏移**：每層額外 `-z × 1 px` 上移，模擬透視堆疊感（每上升一層向畫面上方偏 1 px）。實作時應與 `s(z)` 一起套用，順序：先 scale cell size 再套 offset。

#### 2.2.3 Depth Ring（深度環）

- 井道深度分 12 層，每層畫一圈 depth ring（井道邊框內縮版）。
- **警戒高度 `Z=10`**：以**紅色 depth ring** 標示（配合 game over top-out 條件 §2.4.3 的 spawn zone 提醒；不遮擋遊戲區）。
- Ring 樣式：非填充、線框（1 px `--rim-soft`），透過 `transform: scale(var(--s))` 沿 §2.2.2 公式縮放。

#### 2.2.4 井壁（暫定）

- **暫用**：透明井壁 + depth ring 呈現，不採實體井壁材質。
- **狀態**：**未定案**。井壁 A / B / C 方案（透明壁 / 前壁切開 / 近端深度淡化）將由人類另派 LA8 出 mockup，之後在本 ADR 或後續 ADR 補上。
- 本 ADR **不 mandate** 任何井壁方案，實作階段可先以暫定透明壁 + depth ring 上線，待井壁 ADR 出來再切換。

### 2.3 Layer 2 — Piece / Interaction 視覺

#### 2.3.1 繪法基礎

- **繪法**：SVG outline path（或 three.js 等效路徑繪製），使用 `edgeMap` 消共享邊 —— 相鄰 cell 之間不重複繪邊。
- **Winding**：counterclockwise（CCW）— 對應 SVG `fill-rule` 與 shader normal 一致。
- **Cell center 投影**：從 grid 中心 `(40, 40)`（mockup 座標系）向外 scale，Y 再加 §2.2.2 的 `-z × 1` 偏移。實作端應以 board 中心為投影原點，非 mockup 硬編碼的 `(40, 40)`。
- **Piece 定義**：座標來源同 ADR-0002 §2.1 canonical 12 polycube（`src/engine/pieces/definitions.ts`）。本 ADR 不重複定義 piece 幾何，只規範**呈現方式**。

#### 2.3.2 狀態視覺對應

| 狀態 | 線框 | 填色 | Cell 格線 | 備註 |
|------|------|------|-----------|------|
| **Active**（玩家控制中） | 綠色 1 px | 透明 | 每格 70% opacity / 0.8 px | 顯示 piece 形狀與朝向 |
| **Ghost**（落點預覽） | 白色虛線 | 無 | 無 | 投影於 `Z=0` 落點；不干擾實體視覺 |
| **Locked**（已鎖定） | 無額外描邊（fill 邊即輪廓） | 實心（依 typeId 配色） | 白色 cell 格線 | 每格 cell 需清楚可見以助掃描 |
| **警戒高度標記**（`Z=10`） | 紅色 depth ring（Layer 1） | — | — | 屬 Layer 1；此列為交叉參考 |

#### 2.3.3 顏色 / 可讀性不變式

- **顏色不是唯一識別**（與 `oab/design/piece-catalog` 一致）：狀態 + type 需靠 outline style、fill 差異、cell 格線與 type ID 呈現，方便色弱使用者辨識。
- **Active vs Locked** 主要差異：outline stroke（綠色線框 vs 無/fill 邊）+ fill（透明 vs 實心），而非只靠顏色深淺。
- **Ghost vs Active** 主要差異：dash pattern（虛線 vs 實線）+ fill（空 vs 半透明）。

### 2.4 開放參數 (Tunables)

以下數值**於本 ADR 記錄為 mockup 選定值**，實作階段允許人類 / 設計 iterate，不需重發 ADR：

- Tilt 角度：`-5°`（如需比較 `0°` / `-3°` / `-8°` 等，記入 `oab/design/top-down-z-view`）
- Scale 曲線常數：`(z/12)² × 7`（若視覺不佳可調整二次係數或曲率）
- Y 垂直偏移：`-z × 1 px`
- Depth ring 顏色 / 線寬
- Active outline 顏色（目前綠 1 px）
- Cell 格線 opacity / 線寬（目前 70% / 0.8 px）

**閉合參數**（改動需 amend 本 ADR）：

- 兩層拆分本身（Layer 1 / Layer 2）
- 非物理 scale 的**本質**（若改為真 3D perspective camera，屬結構變更）
- Ghost 為「投影至 `Z=0`」而非其他呈現
- Active/Ghost/Locked 三態存在與功能定位

## 3. 已考慮的替代方案 (Alternatives Considered)

### 3.1 純 3D perspective camera（three.js `PerspectiveCamera`）

- **優點**：光學物理一致、實作直接、未來若加自由視角轉場容易。
- **缺點**：井口 8× / 井底 1× 這種戲劇化縮放需極端 FOV 或極近相機，會導致 UI 座標對應困難、低層 cell 過小無法辨識。
- **裁決**：拒絕作 MVP 預設；保留為未來升級選項（見 §5 後續行動）。

### 3.2 純垂直俯視（`0°` tilt / top-down）

- **優點**：完全消除 Z 軸壓縮視覺誤判；與 `oab/design/top-down-z-view` 3° 微傾同一家族。
- **缺點**：失去井道空間感，玩家難以直覺感知「深度」與 active piece 高度；需靠額外 HUD ruler。
- **裁決**：拒絕作預設；保留為 accessibility toggle 候選（未定案）。

### 3.3 ADR-0001 §2.5 預設 20° pitch

- **優點**：現行 accepted ADR、無 delta。
- **缺點**：井道透視強、5×5 井底單元格在遠端變形嚴重；不符合玩家「井中投擲」的空間隱喻。
- **裁決**：**不取代**，本 ADR 屬 §2.5 允許的「純垂直俯視」alt mode 具體規範；預設由誰擔任待後續 usability review。

### 3.4 單一 ADR 混合 Layer 1 + Layer 2 vs 拆兩份 ADR

- **考量**：Layer 1 屬 renderer 全域、Layer 2 屬 piece / interaction，未來 iterate 頻率可能不同（Layer 2 可能因 accessibility 頻繁調整；Layer 1 相對穩定）。
- **裁決**：**本 ADR 內部分兩節**（§2.2、§2.3），保留未來拆兩份 ADR 的空間（若 Layer 2 iterate 頻率確實高於 Layer 1，可從本 ADR 分出 ADR-0008a / 0008b 或另編號）。

## 4. 影響 (Consequences)

### 4.1 對 M4 Renderer 實作

- Renderer 需引入自訂 per-layer scale 邏輯（非依賴 three.js 內建投影），複雜度略增。
- 已鎖定 `InstancedMesh`（ADR-0001 §2.5）需與 §2.2.2 scale 公式相容：可能改為每層一個 `InstancedMesh` 或在 vertex shader 內以 `z` 施加 scale。
- Ghost 落點運算（見 ADR-0001 §2.5、ADR-0004 §2.4）投影規則不變（Z=0），只需依 §2.3.1 改樣式。

### 4.2 對 ADR-0001 §2.5 renderOrder 分層

- §2.5 定義 renderOrder：井壁 0 / locked 1 / ghost 2 / active 3。**本 ADR 不變更該順序**。
- 井壁 renderOrder 語意在井壁 A/B/C 決策落地前保留（暫定透明壁 + depth ring 屬井壁 renderOrder 0 的實例）。

### 4.3 對 ADR-0007（UI 疊層）

- UI 疊層（HUD、選單）仍屬 React + Tailwind DOM overlay（ADR-0007 rev.3），本 ADR 不涉及。
- **但**：depth ring 警戒 `Z=10` 的紅色是**井道場景元素**，屬 canvas 內繪製，不進 DOM overlay，避免 z-index 錯位。

### 4.4 對效能 (Performance)

- 二次 scale + per-layer offset：若採 shader 內計算，成本可忽略；若採 CPU 端每 tick 重算並改 mesh transform，需 profile。
- Depth ring 12 圈：`LineSegments` 或 `EdgesGeometry` 皆足夠；不進 InstancedMesh。
- Cell 格線（70% opacity / 0.8 px）：Locked cells 若 300 個都要格線，需驗證 alpha blending 對 fill rate 的影響 — 建議 LA6 review。

### 4.5 未決風險

- **1 px active outline** 在高 DPR 顯示器與縮小視窗下的可見性未驗證。
- **非物理 scale** 與未來若接入手勢 / VR / mobile pinch-zoom 的相容性未驗證。
- **井壁 A/B/C 未定**，實作階段以透明壁 + depth ring 佔位，切換時需保留 renderOrder 語意。

## 5. 後續行動 (Follow-ups)

- **LA6 review**（效能與前瞻性）：per-layer scale 對 InstancedMesh 的影響、cell 格線 alpha blending fill rate、未來 3D perspective 升級性。
- **LA7 review**（安全性 / 使用者漏洞）：`-5°` tilt + 二次 scale 對色弱 / 動暈 / 高 DPR 使用者的可及性。
- **LA4 review**（正確性 / 技術棧）：three.js 端最佳實作路徑（shader vs CPU）。
- **人類另派 LA8 出井壁 A/B/C mockup**，之後 amend §2.2.4 或另開井壁 ADR。
- **Mobile responsive**：目前 mockup 僅 desktop；mobile 版本另派 LA8。
- **Usability**：`-5°` 是否取代 20° 成新預設，待玩家測試後決定；本 ADR 目前只定義 alt mode 規範。

## 6. 修訂紀錄 (Revision History)

- **rev.1（2026-07-25，draft）** — LA1 首版草稿；依 brain `oab/design/tetris-xl-well-shaft` (page 180) 與 mockup HTML `design/tetris-xl-well-shaft@e439844` 交叉核對 tilt/scale/cell 規則。狀態 `proposed`，待 review agents 與人類 sign-off 後才能升 `accepted`。
