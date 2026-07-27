---
title: ADR-0009 Well Visibility Presets & Depth-Fade Wall Treatment
type: decision
status: proposed
adr_id: "0009"
repo: topweedev/tetris-XL
path: docs/adr/0009-well-visibility-presets.md
tags: [adr, tetris-xl, renderer, visual, three-js, well-shaft, presets, a11y]
---

# ADR-0009: Well Visibility Presets & Depth-Fade Wall Treatment（井壁可視性 presets 與近端深度淡化）

- 狀態：Proposed（rev.2 — 收斂 LA4 r1 + LA6 r1 + LA7 r1 findings；待 r2 mini-sanity + 人類 accept）
- 日期：2026-07-27
- 決策者：LA1 起草；LA4 (correctness) r1 NEEDS_CHANGES 0B/1S/5N + verified_clean × 10、LA6 (perf/forward) r1 BLOCKED 1B/3S/1N、LA7 (a11y/security) r1 PASS 0B/6S/2N → rev.2 收斂 blocker + shoulds + nits，待 r2 mini-sanity 確認
- 相關文件：
  - ADR-0001 §2.5（renderOrder 分層、單一 `InstancedMesh`、alt-mode 相機家族）
  - **ADR-0008 §2.2.4**（井壁「暫定」— 本 ADR 為其**閉合 amend 對象**，見 §2.4 delta）
  - ADR-0008 §2.3.2（active / ghost / locked / warning 狀態視覺 — 本 ADR §2.3 引用）
  - ADR-0007 rev.3（React + Tailwind UI 疊層 — 本 ADR §2.5 A11y toggle 出口）
  - Brain: `oab/design/well-visibility-comparison`（LA8 mockup A/B/C 完整脈絡）
  - Brain: `oab/design/piece-visual-rendering-brief` §3.7（`translucent` / `high-contrast` / `opaque-fallback` preset 定義來源）
  - Brain: `oab/design/tetris-xl-well-shaft`（ADR-0008 mockup 上游 — 井道透視 + depth ring baseline）
  - Brain: `oab/pr/25-review-la4`（LA4 correctness r1 · NEEDS_CHANGES · findings + verified_clean × 10）
  - Brain: `oab/pr/25-review-la6`（LA6 perf/forward r1 · BLOCKED · smoothstep vertex-density + fill-rate + context restore + theme API + material sharing）
  - Mockup artifacts：
    - Branch `design/well-visibility-comparison` @ `305a3f8`
    - `design-prototypes/tetris-xl/well-visibility-comparison/index.html`

## 1. 背景 (Context)

### 1.1 ADR-0008 遺留的 §2.2.4「井壁暫定」

ADR-0008 §2.2.4（accepted 2026-07-25）明確標記井壁具體處理為 **暫定**，並指向 `oab/design/well-visibility-comparison`，等待人類另派 LA8 出 mockup 後補入 ADR 或另立 ADR。本 ADR 為該暫定的**閉合**。

### 1.2 LA8 於 2026-07-24 05:55 UTC 交付 mockup

人類在 `#design-lab` 直接派 LA8 出井壁可視性比較 mockup（LA1 未經手 dispatch，符合 AGENTS.md「LA1 絕不 dispatch LA8」規則）。LA8 交付單一 HTML mockup 涵蓋三種井壁處理：

| 方案 | 井壁處理 | 井道感 | 井底辨識 | 疊色風險 |
|------|----------|--------|----------|----------|
| **A** 完整透明井壁 | 全 wall 半透明；不淡化 | 最高 | 中 | **高**（複雜堆疊易疊色） |
| **B** 前壁切開 | 前壁完全裁掉；只保留後 3 面 | 低（剖面感） | **最高** | 低 |
| **C** 近端深度淡化 | 保留井口 rim + 透視輪廓；近端牆面隨玩家視線接近井底時淡出（alpha decay by camera-space Z） | 高 | 高 | 低 |

**LA8 推薦：C 作 baseline default、B 作 high-contrast fallback**（`oab/design/well-visibility-comparison` §「LA8 read」）。

### 1.3 與 `piece-visual-rendering-brief` §3.7 preset 對應

`oab/design/piece-visual-rendering-brief` §3.7 已預先定義 renderer 三種內部 preset：

- `translucent`（預設）— baseline
- `high-contrast` — active fill 提升至 ~0.68，edge 加亮加粗
- `opaque-fallback` — active fill ~0.92，供透明排序異常 / 低階 GPU / 個人偏好

LA8 的 A/B/C 井壁處理與 §3.7 三種 preset **正交但可對齊**：井壁 fade 屬於**場景 / renderer 全域偏好**，preset 屬於**方塊透明策略**。本 ADR 把兩者整合為單一 preset 系統，避免兩套獨立設定造成 renderer 內部參數爆炸。

## 2. 決策 (Decision)

### 2.1 定位與適用範圍

本 ADR **只涵蓋井壁 rendering 表現 + preset 系統**，不涉及：

- 井道尺寸 / 座標 / 深度環數學（見 ADR-0008 §2.2.2、§2.2.3）
- 方塊 / active / ghost / locked 視覺（見 ADR-0008 §2.3）
- 相機 tilt 家族（見 ADR-0001 §2.5 + ADR-0008 §2.1；`-5°` 與潛在 `3°` alt-mode 屬 §2.5 near-vertical 家族，**本 ADR 不擴張其語意**）

### 2.2 井壁 rendering — 採用 LA8 Option C（近端深度淡化）為 default

井壁使用 **camera-space Z 距離驅動的 alpha decay**：

```text
wallAlpha(zCam) = smoothstep(FADE_NEAR, FADE_FAR, |zCam|) × BASE_WALL_ALPHA
```

- **BASE_WALL_ALPHA**：`0.28`（tunable，見 §2.4）— 井壁遠端最大不透明度
- **FADE_NEAR**：`camera.near + 0.5` world units — 淡化起點（越靠近相機越淡）
- **FADE_FAR**：`camera.near + 2.5` world units — 淡化終點（超過此距離為 BASE_WALL_ALPHA）
- 井口 rim（`z = board.depth`，即 z=12 一圈頂邊）**不套用 fade**；rim 保持 `1.0` alpha 作為井道邊界穩定錨點
- Floor（`z = 0`）不繪井壁，只保留 board floor material（見 ADR-0008 §2.2.3）
- Depth ring（z=1..11 + rim）不受本規則影響；ring 使用 ADR-0008 §2.2.3 既有規則

**幾何 / 材質**（rev.2 — LA6 B1 blocker + LA4 N1/N2 修正）：

- **Wall 幾何**：4 面 `PlaneGeometry(WIDTH, HEIGHT, 1, DEPTH_SEGMENTS)`（後 / 左 / 右 / 前），其中：
  - `WIDTH` / `HEIGHT` 對齊 board XY / Z 世界座標（見 ADR-0008 §2.2.2）
  - **`DEPTH_SEGMENTS = 12`**（與 board Z depth + depth ring 分布對齊；每 segment = 一 z-cell 高度）
  - **理由**：`smoothstep(FADE_NEAR, FADE_FAR, |zCam|)` 為 S-curve，若 wall 只有 default 1×1 segments（4 vertex），linear vertex interpolation **無法** encode S-curve → 退化為 corner 值 linear ramp + low-vertex-density banding（LA6 B1）
  - 12 段對 smoothstep 之 RMS 誤差 < 2%；未來若需更平滑可提升至 24（進 M11 rev.N）
- **Vertex 序**：four wall meshes 各自為 `PlaneGeometry`，vertex 順序沿 three.js `PlaneGeometry` 慣例（左下→右下→左上→右上，逐 row scan）；per-vertex world Z 由 vertex position 直接推導、bake 進 vertex color 之 alpha channel
- **Vertex color attribute**：`Float32BufferAttribute(colors, 4)` — **`itemSize = 4`**（RGBA），非 default 3（RGB）；three.js r160+ 內建 `MeshBasicMaterial` / `MeshStandardMaterial` 於 `vertexColors: true` + `transparent: true` + `itemSize=4` 時自動走 `USE_COLOR_ALPHA` 路徑（LA6 verified）
- **BufferAttribute 生命週期**（rev.2 — LA6 S2）：於 wall setup 時 `new Float32Array(vertexCount × 4)` 一次配置，preset 切換或 context restore 走 **in-place mutation + `attribute.needsUpdate = true`**；**禁止**每次 restore 或 preset switch `new Float32Array(...)` → per-frame allocation = 0 之聲明依此成立
- **Material**：4 面 wall 共用**單一** `MeshBasicMaterial`（或等價）instance；preset 切換透過 mutate 材質 uniform / 共享 `BufferAttribute` 值達成，**不 clone material per wall**（LA6 N1；否則 shader program 切換抵消 allocation=0 宣稱）
- `depthWrite: false`（沿用 **ADR-0001 §2.5 line 137** wall 慣例；避免半透明面互相 z-fighting）
- `renderOrder: 0`（沿用 ADR-0001 §2.5 wall < locked < ghost < active 排序）
- `transparent: true`

**與 Option A（完整透明井壁）之差**：A 為全牆同一 alpha 無 depth 淡化；本 ADR 之 C 靠 alpha decay 讓「玩家視角近端」自然消隱，避免 A 之疊色。

**與 Option B（前壁切開）之差**：B 為 hard cut，MVP 不做為 default；B 保留作 §2.3 `high-contrast` preset 的**選擇性 fallback**（見 §2.3.2）。

### 2.3 Preset 系統 — 三 preset 整合 `piece-visual-rendering-brief` §3.7 與 LA8 A/B/C

Renderer 提供**單一 `preset` token**，同時控制井壁 + 方塊透明策略。MVP UI 不強制暴露設定入口；preset enum / type 與 runtime 預設值由 `src/render/theme.ts` 匯出，作為 M6+ preset UI 的 forward-compat 接口（**API contract 見 §2.3.4**，rev.2 新增）。

#### 2.3.1 Preset 定義

| Preset | 井壁 | Active fill | Locked fill | Ghost | 對應 LA8 option |
|--------|------|-------------|-------------|-------|------------------|
| **`translucent`**（**default**） | §2.2 C 近端 fade（BASE_WALL_ALPHA=0.28） | **≈ 0.58**（`piece-visual-rendering-brief` **§3.1** 首輪 playtest baseline；可接受範圍 0.50–0.68） | opaque | dashed wireframe（ADR-0008 §2.3.2） | **C** |
| **`high-contrast`** | §2.2 C 近端 fade（BASE_WALL_ALPHA=**0.15**，更透明；可選 §2.3.2 前壁裁切） | ≈ 0.68（`piece-visual-rendering-brief` §3.7） | opaque | dashed wireframe，line width +50% | **B** subset |
| **`opaque-fallback`** | §2.2 C 近端 fade（BASE_WALL_ALPHA=0.28） | ≈ 0.92（`piece-visual-rendering-brief` §3.7） | opaque | dashed wireframe | 不對應（fallback for GPU / sort issue） |

Preset 切換**不影響**：

- Depth ring 幾何 / 顏色（ADR-0008 §2.2.3）
- Piece typeId palette（ADR-0008 §2.3.3 非顏色冗餘 mandate）
- Camera tilt / 投影（ADR-0001 §2.5 + ADR-0008 §2.1）
- Engine collision / rotation / kick / score / replay（`piece-visual-rendering-brief` §4）

#### 2.3.2 `high-contrast` 之 optional 前壁裁切

`high-contrast` preset **可**額外啟用「前壁裁切」子選項（對應 LA8 Option B）：

- 於 material set 中，前壁（camera-facing wall）material `visible: false` 或 alpha=0
- 保留後、左、右 3 面之 wall meshes
- **Rim**（§2.2 之 z=12 頂邊）為**獨立幾何**（`LineSegments` 或獨立 mesh），**不受 cutaway 影響**；即使前壁裁切，rim 仍完整顯示於四邊，維持井道邊界穩定錨點（rev.2 — LA4 N3）
- Depth ring（z=1..11）為獨立幾何（見 ADR-0008 §2.2.3），亦**不受 cutaway 影響**
- 該子選項預設 **OFF**；M4 dogfood playtest（見 §4.2）若發現 `high-contrast` 之 wall fade 對高堆疊仍不夠透明，才啟用該子選項並記錄於 `oab/decisions/well-cutaway-enable`

#### 2.3.3 Preset 儲存與 replay 不變性（rev.2 — LA7 S3/S4/S5 + LA6 S3 + LA4 N5）

**Persistence via ADR-0006 SettingsSchema（LA7 S3/S4；LA6 S3；LA4 N5）**：

- Preset 為**本機 UI 偏好**，儲存必須透過 **ADR-0006 §2.5 `SettingsSchema`** 之 `readValidated` / `writeValidated` path；**禁止**直接讀寫 `localStorage`
- Key namespace：`tetris-xl:settings:v<N>`（`N` 由 ADR-0006 §2.8 schema version bump 決定；rev.2 起本 ADR 觸發之新欄位為 SettingsSchema **v2**）
- SettingsSchema v2 需新增（**forward-compat**，ADR-0006 §2.8 schema version bump prerequisite）：
  - `renderPreset: z.enum(['translucent', 'high-contrast', 'opaque-fallback']).default('translucent')`
  - `highContrastCutaway: z.boolean().default(false)`
- **Storage encoding**（LA6 S3）：`localStorage` 值為 **versioned JSON**，形式 `{ v: 2, renderPreset: '...', highContrastCutaway: bool, ... }`；**禁止**存純字串 preset；未來 M7+ 擴充 UI 設定時走 SettingsSchema v3 migration（ADR-0006 §2.8）
- Load-time：走 `readValidated`；schema 失敗（例如 unknown value、缺欄位、非 versioned JSON）→ fallback 為預設值 `translucent` / `false`（**不 throw**；沿用 ADR-0006 §2.6 F6 行為）
- ADR-0006 §2.5 目前 `SettingsSchema` 欄位（`volume` / `cameraMode` / `touchEnabled` / `reduceMotion`）**維持不變**；本 ADR 僅**擴充**新欄位、不修改既有

**Replay 中立性 + 遊戲決定論不變式（LA7 S5）**：

- **禁止進入 replay header**（沿用 `piece-visual-rendering-brief` §3.7 最末段；LA4 verified `oab/pr/25-review-la4` — preset 不在 header(32B) / events(6B) / footer(40B) / adrHash list）
- **禁止影響**：collision、rotation、kick、score、game FSM
- **明確 codebase invariant**（LA7 S5，強不變式）：
  - `renderPreset` / `highContrastCutaway` **僅能於 `src/render/*` 讀取**（`src/render/theme.ts` 匯出、`src/render/well.ts` / `src/render/piece.ts` 等消費）
  - **禁止**出現於：`src/engine/core/fsm.ts`、`src/engine/core/step.ts`、`src/engine/replay/**`、`scripts/adr-hash.mjs` 或任何 `adrHash` 檔案清單
  - CI check：可於 M7 replay engine 之 `no-restricted-imports` ESLint rule 補入（本 ADR 為 M4 提出 spec；ESLint enforcement 屬 M7 責任）
- 替換 preset 於 game FSM `RUNNING` 期間**允許**，但必須為 pure renderer swap（無 game-state 副作用；LA4 verified）
- **BufferAttribute 生命週期**（§2.2）：preset 切換 in-place mutate `attribute.array` + `needsUpdate = true`，不觸發任何 `Float32Array` 重配置

#### 2.3.4 `src/render/theme.ts` API contract（rev.2 新增 — LA6 S3）

為避免 M6+ React UI 直接耦合 three.js 內部，`src/render/theme.ts` **必須**匯出以下最小 API contract：

```ts
// Type
export type RenderPreset = 'translucent' | 'high-contrast' | 'opaque-fallback';

// Runtime defaults (must match SettingsSchema v2 zod defaults in §2.3.3)
export const DEFAULT_PRESET: RenderPreset = 'translucent';
export const DEFAULT_HIGH_CONTRAST_CUTAWAY: boolean = false;

// Preset getter (never throws; falls back to DEFAULT_PRESET via readValidated)
export function getPreset(): RenderPreset;

// Preset setter — pure renderer swap (§2.3.3 invariants apply);
// writes via ADR-0006 SettingsSchema writeValidated
export function setPreset(preset: RenderPreset): void;

// Optional cutaway toggle (only meaningful when preset === 'high-contrast')
export function getHighContrastCutaway(): boolean;
export function setHighContrastCutaway(enabled: boolean): void;

// Change subscription — synchronous callback invoked after successful set
export function subscribe(cb: (state: { preset: RenderPreset; highContrastCutaway: boolean }) => void): () => void; // returns unsubscribe
```

Constraints：

- `setPreset` / `setHighContrastCutaway` **禁止**觸發 game-state 讀寫（純 renderer 邊界；LA7 S5）
- `subscribe` 之 callback **禁止**於 game tick hot path 執行任何 blocking work（M4 renderer 之 `well.ts` / `piece.ts` 應僅 mutate `BufferAttribute` 或 material uniform）
- `getPreset` / `getHighContrastCutaway` 於 boot 時走 `readValidated`；之後從 in-memory cache 讀，不 hit `localStorage`（避免 preset switch 期間 IO）
- `React` UI（M6+）**必須**透過此 API，禁止直接 import `src/render/well.ts` 或碰 three.js 物件

WebGL context restore 路徑（§4.3）：context restore 後由 renderer 主動呼叫 `getPreset()` + `getHighContrastCutaway()` 重建 vertex color；in-memory cache 為 source of truth，`localStorage` 不重讀。

### 2.4 開放參數 (Tunables) & 對 ADR-0008 §2.2.4 之 delta

本 ADR **amend** ADR-0008 §2.2.4「暫定」為 accepted，內容替換為本 ADR §2.2；ADR-0008 rev.5 之 §6 修訂欄記錄本 amend。

| Tunable | Default | 說明 |
|---------|---------|------|
| `BASE_WALL_ALPHA` (translucent, opaque-fallback) | `0.28` | 井壁遠端最大不透明度 |
| `BASE_WALL_ALPHA` (high-contrast) | `0.15` | 更透明以配合 active fill 提升 |
| `FADE_NEAR` (world units) | `camera.near + 0.5` | 淡化起點 |
| `FADE_FAR` (world units) | `camera.near + 2.5` | 淡化終點 |
| `HIGH_CONTRAST_CUTAWAY` | `false` | `high-contrast` 是否啟用前壁裁切 |

MVP M4 使用預設值；tuning 進 M11 rev.N。

### 2.5 A11y 對接（沿用 ADR-0008 §2.3.3 + `piece-visual-rendering-brief` §5；rev.2 — LA7 S1/S2/S6 + LA4 N4/LA7 N2）

**WCAG 1.4.11 對比 ≥ 3:1（rev.2 — LA7 S1）**：

- 井壁 outline / rim 對 **alpha-composited 最終畫素**（wall + locked + background 合成色）必須 ≥ 3:1
- **最壞點 = `high-contrast` preset**（BASE_WALL_ALPHA = **0.15**，rev.1 誤指 translucent 0.28）：wall 於此 preset 最透明，rim / outline 對背景 + 相鄰 locked cell 之對比最脆弱；§4.2 accept criteria 明列此組合
- 對比驗證**禁止**只看單一 wall alpha 或單一 palette 色；必須以 renderer 產出的 rasterized composite 為準

**CVD 距離 ≥ 0.3（rev.2 — LA7 S2）**：

- CVD (Machado 2009 matrices — prot / deuter / trit) 距離檢查**必須**套用於 **alpha-composited 最終畫素**（wall + locked + background 合成色）
- **禁止**只對單獨 locked palette 或 wall alpha 做 CVD 檢查；wall 之 alpha decay 會改變 locked cell 的 effective 背景色，high-contrast 之 wall 0.15 下若忽略此合成，可能通過門檻但實際疊色
- 三 preset × 3 CVD sims × 兩隨機 stack seeds，全部通過（見 §4.2）

**顏色不是唯一識別**：wall fade **不得**替代 depth ring 作為深度線索；rim + depth ring 為 primary depth cue，wall alpha 為 supplementary（沿用 ADR-0008 §2.3.3 非顏色冗餘 mandate）

**`prefers-reduced-motion`（rev.2 — LA4 N4 + LA7 N2）**：

- Wall fade 為 static function of Z（vertex color bake），本身**不含** pulse / animation；此 aspect 無需 reduced-motion toggle
- **例外**：若 M6+ preset UI 加入 preset switch **CSS transition**（e.g. fade-in / cross-fade 動畫），該 transition **必須**遵守 `@media (prefers-reduced-motion: reduce)` — 立即切換、不做 easing、不做動畫過場
- Renderer 端 preset switch 於 `RUNNING` 期間**建議**為 instant swap（`BufferAttribute` in-place update 一 frame 完成）；若未來實作為 gradient transition（動畫化），同樣受 `prefers-reduced-motion` 約束

**Preset UI 出口（M6+）**：

- 走 ADR-0007 rev.3 React + Tailwind DOM overlay；經 §2.3.4 `theme.ts` API contract 存取，禁止直接 import renderer 模組
- Replay share 過程 preset 不寫入 header（§2.3.3）

**ARIA live region（rev.2 — LA7 S6）**：

- Preset 變更 announce 為 `role="status"`（polite）；不 interrupt gameplay
- **與 line clear / game over / warning 之 ARIA live region 協調**：若 M6+ 需並發多種 polite 訊息（preset switch 恰好與 line clear 同一 tick），**必須**經 ADR-0007 rev.3 之 **`ARIAAnnouncer`** 集中批次化，避免訊息被覆蓋或順序錯亂
- `ARIAAnnouncer` 於 M6+ HUD 實作，本 ADR 為需求提出方；M4 renderer 不直接寫 ARIA DOM（避免耦合 React）

## 3. 已考慮的替代方案 (Alternatives Considered)

### 3.1 Option A（完整透明井壁）為 default

- 優點：實作最簡（單一 alpha uniform）、井道感最強
- 缺點：**複雜堆疊時牆面色彩與 locked cell 疊色**，違反 ADR-0008 §2.3.3 非顏色冗餘 mandate；`piece-visual-rendering-brief` §3.5 明列此為禁事
- 結論：不採為 default；A 於 `translucent` 之 alpha decay 已被吸收（近端仍透明、遠端保留井道感）

### 3.2 Option B（前壁切開）為 default

- 優點：井底辨識最高
- 缺點：破壞「井道」空間隱喻，剖面模型感偏向 sim 而非 game；M4 dogfood 若受眾為傳統 Tetris 玩家，剖面感可能反直覺
- 結論：不採為 default；保留為 `high-contrast` preset 之 optional 子選項（§2.3.2）

### 3.3 井壁 x-ray shader（強制 depthTest off）

- 優點：active 永不被遮擋
- 缺點：破壞前後關係，玩家會誤判 piece 是否位於井壁前方；違反 `piece-visual-rendering-brief` §D
- 結論：不採用

### 3.4 兩套獨立 setting（井壁 + preset 各自可選）

- 優點：極高彈性
- 缺點：**setting matrix 爆炸**（3 井壁 × 3 preset = 9 組合），MVP 只能驗證極少數；`piece-visual-rendering-brief` 已明列 preset 為 single-axis token
- 結論：不採用；本 ADR §2.3 為 single-token 整合設計

### 3.5 使用 shader-based alpha decay（vs vertex color）

- 優點：更精確、能加入 depth-based 顏色 shift
- 缺點：需 custom `ShaderMaterial`，M4 CSP `style-src 'self'` 對 shader 影響雖無關（shader 在 WebGL 內），但 material fallback 於 WebGL context restore 複雜度提升
- 結論：MVP 採 vertex color；shader-based 為 M11+ rev.N 選項

## 4. 影響 (Consequences)

### 4.1 對 M4 P4.1 Renderer 實作

- **新增檔案 / 責任**：
  - `src/render/theme.ts` — preset token、tunable 常數集中
  - `src/render/well.ts` — 井壁幾何 + vertex color alpha decay
- **移除 / 修改**：ADR-0008 §2.2.4 之「暫定」段落於 rev.5 替換為引用本 ADR
- **M4 P4.1 scope 影響**：`well.ts` 從「純 wireframe」升級為「4 面 plane + vertex color alpha + rim」；LOC 預估 +80 line（含 material setup 與 preset switch stub）
- **preset UI 不強制**：MVP M4 只需 code-level 常數；Settings UI 延到 M6+

### 4.2 M4 verification acceptance（rev.2 — LA7 S1/S2；LA3 e2e 需涵蓋）

- **視覺 case**：
  - 空井道於 `translucent` / `high-contrast` / `opaque-fallback` 三 preset 之 screenshot diff
  - 堆疊井底於三 preset 之 locked cell 辨識（自動 CV：locked cell 中心 alpha ≥ 0.85）
  - `high-contrast` + `HIGH_CONTRAST_CUTAWAY=true` 前壁裁切 case；rim + depth ring **仍完整可見**（§2.3.2）
- **WCAG 1.4.11 對比檢查**（rev.2 — LA7 S1）：
  - 對比計算**必須**基於 renderer rasterized output 之 **alpha-composited 最終畫素**（wall + locked + background 合成色），非單一 wall alpha
  - 最壞點檢驗：`high-contrast` preset（BASE_WALL_ALPHA=0.15）× locked palette 最深色 × 井底堆疊背景之 rim / outline 對比 ≥ 3:1
  - 每 preset × 3 view heights (spawn buffer / mid / bottom) 各驗
- **CVD automated check**（rev.2 — LA7 S2）：
  - CVD (Machado 2009) 距離**必須**於 **alpha-composited 最終畫素**計算，非 palette 原色
  - 三 preset × 3 CVD 模擬（prot / deuter / trit）× 兩隨機 stack seed，全部通過 ADR-0008 §2.3.3 CVD ≥ 0.3
- **DPR pixel test**：wall alpha decay 於 DPR ∈ {1, 1.5, 2, 3} 之邊界 pixel 不出現 ≥ 1 CSS px 的 aliasing artifact；`DEPTH_SEGMENTS=12` 之 vertex interpolation banding 於各 DPR 下不可見（若 M4 profile 可見則 §5 M11 rev.N 提升至 24）
- **Preset switch replay 中立性**：同一 seed + 同一 input sequence，於三 preset 下產生**位元相同**的 replay bytes（沿用 ADR-0006 replay determinism；LA4 verified §4.2 replay chain — preset 不在 header/events/footer/adrHash）
- **SettingsSchema 邊界測試**（rev.2 — LA7 S3/S4；LA6 S3）：
  - Malformed `localStorage` JSON（缺 `v`、`v: 1`、unknown enum、boolean 型別錯）皆 fallback 為預設值不 throw
  - Schema v2 → v3 migration 走 ADR-0006 §2.8 path（本 ADR 為 M7 提出 forward-compat 需求）
- **API contract 靜態檢查**（rev.2 — LA6 S3）：
  - `src/render/theme.ts` 匯出符合 §2.3.4 之 signature（TypeScript 型別 + 至少 unit test 覆蓋 `setPreset` 於 RUNNING 期間為 pure renderer swap）
  - 靜態掃描確認 `renderPreset` / `highContrastCutaway` 未出現於 `src/engine/**` 或 `scripts/adr-hash.mjs`（LA7 S5 codebase invariant）

### 4.3 對效能 (Performance)（rev.2 — LA6 S1/S2/N1）

**Draw call & 幾何**：

- 井壁從「4 個 `LineSegments`」升級為「4 個 `Mesh` 帶 vertex color alpha (`itemSize=4`)」：draw call 依然 = 4
- **4 wall Meshes 共用單一 material instance**（LA6 N1）；preset 切換透過 mutate 共享 `BufferAttribute` 值達成，**不 clone material per wall**；否則 shader program 切換會抵消 allocation=0 宣稱
- Per-frame allocation = 0（`BufferAttribute.array` 於 setup 時 `new Float32Array(...)` 一次配置，之後 in-place mutate + `needsUpdate=true`）
- `DEPTH_SEGMENTS=12` × 4 walls = **48 個額外 quads**（96 tris），相對 60 locked cells 之 ~720 tris 為 6.7%，可忽略

**Alpha blend fragment cost（rev.2 — LA6 S1 fill-rate acceptance clause）**：

- MVP 場景上限 = 60 locked cells + active + ghost + 4 wall + 13 ring
- LA6 quick fill-rate model（1080p60，wall `depthWrite=false`，locked `depthWrite=true`）：
  - 4 walls 覆蓋 ~0.4–1.0M screen fragments
  - 60 locked + active/ghost 前/上/側面 ~0.3–0.6M visible fragments
  - Total blended/overdrawn ~1.2–1.8M/frame → 72–108M/s
- **桌面 / Apple Silicon (~10 Gpix/s)**：0.12–0.18 ms/frame (<1% of 16.67 ms) ✅
- **低階 integrated GPU (~2 Gpix/s)**：0.6–0.9 ms/frame (~4–5% of 16.67 ms)
- **M4 fill-rate acceptance clause**：
  - Reference budget = 1080p60 desktop
  - **Hard gate**：wall + locked + active/ghost 之 rasterized fragment blend **不得 > 0.3 ms/frame** 或 **> 2%** GPU frame budget（以 `performance.measure` + WebGL disjoint timer 量）
  - 超標 fallback path：自動切換 `opaque-fallback` preset（fill 0.92 減少 blend area）或啟用 `HIGH_CONTRAST_CUTAWAY=true`；使用者可於 M6+ Settings UI 覆蓋
  - Fallback 事件走 §2.5 ARIA polite queue announce（`renderPreset auto-adjusted to opaque-fallback due to fill-rate budget`）
- **`depthWrite` policy 明文**（rev.2 — LA6 S1 subclause）：
  - `wall`：`depthWrite = false`（避免半透明 z-fighting）
  - `locked`：`depthWrite = true`（opaque，early-Z cull 有效）
  - `active`：`depthWrite = false`（半透明；避免遮擋堆疊）
  - `ghost`：`depthWrite = false`（wireframe，不寫入 depth）
  - 3D tetracube 內部面 overdraw 由 §3.6 renderOrder + `depthTest:true` 控制（沿用 `piece-visual-rendering-brief` §3.6）

**WebGL context restore 路徑（rev.2 — LA6 S2）**：

- Preset token / cutaway 保存於 renderer in-memory cache（source of truth），context restore 後**不重讀** `localStorage`（避免 IO）
- Context restore 後 re-bake vertex color 為 **O(V)**（`V = 4 walls × (DEPTH_SEGMENTS+1) × 2` = 104 vertices × RGBA = 416 float），非 O(1)
- **`BufferAttribute.array` 於 setup 時預配置**；restore 走 in-place update + `needsUpdate=true`；**禁止**於 restore path `new Float32Array(...)`（LA6 S2 明文）

### 4.4 對 ADR-0008 之 delta

- **ADR-0008 §2.2.4 rev.5 amend**（本 ADR merge 後同步）：
  - 移除「暫定」標記
  - 內容替換為「井壁 rendering 見 ADR-0009 §2.2、preset 系統見 ADR-0009 §2.3」
  - ADR-0008 §6 修訂欄新增 rev.5 條目
- **ADR-0001 §2.5 不受影響**：本 ADR 不涉及 renderOrder / InstancedMesh / camera tilt

### 4.5 未決風險與 M4 verification 條款（rev.2 — 部分項目 LA6 r1 已 close）

- **BASE_WALL_ALPHA = 0.28 / 0.15 未經 dogfood 校準**：M4 P4.2 dogfood 需記錄，若堆疊井底辨識 < 90%（`piece-visual-rendering-brief` §5.2 criteria），M11 rev.2 tune
- **前壁裁切 UX 感受不明**：`HIGH_CONTRAST_CUTAWAY=true` 於 M4 dogfood 為 opt-in 測試；至少 2 位測試者體驗後回饋
- **~~camera-space Z 於 orthographic camera 之語意~~**（**rev.2 CLOSED — LA6 r1 已審**）：LA6 review 於 `oab/pr/25-review-la6` 明確以 orthographic near/far plane 為 `FADE_NEAR`/`FADE_FAR` 基準之語意成立；`smoothstep` 之 vertex interpolation 已由 `DEPTH_SEGMENTS=12` 補足（§2.2），不再列為未決
- **~~`translucent` preset 於 alpha=0.28 之井底暗色 wash~~**（**rev.2 CLARIFIED**）：WCAG 對比檢查（§2.5 / §4.2）已針對 alpha-composited 最終畫素做 hard gate（LA7 S1）；本項不再獨立列，併入 §4.2
- **低階 integrated GPU fill-rate**（rev.2 — LA6 S1 residual）：MVP 於 2 Gpix/s iGPU 之 4–5% budget 使用率為已知風險；§4.3 之 hard gate + auto-fallback 為 mitigation，M4 dogfood 需於至少一台 iGPU 硬體驗證
- **`DEPTH_SEGMENTS=12` banding 於高 DPR**（rev.2 — LA6 B1 residual）：12 段對 smoothstep 之 RMS 誤差 <2%，M4 於 DPR ∈ {1, 1.5, 2, 3} × 4 viewport 需驗證無可見 banding；若可見 → M11 rev.N 提升至 24（§2.2）

## 5. 後續行動 (Follow-ups)

- **本 ADR merge 後同步 amend ADR-0008 rev.5**：LA1 一同 PR，或另發 delta PR（傾向同 PR，減少 hash bump 次數）
- **3° 近垂直 alt-mode tilt**（LA8 於 `oab/design/top-down-z-view` 提出，待人類另決）：**本 ADR 不含**；建議另立 ADR-0010（camera tilt 家族）或 ADR-0008 rev.5 之獨立 amendment
- **Preset UI 出口**（Settings screen）：延到 M6+（HUD milestone），走 ADR-0007 rev.3 React + Tailwind
- **`HIGH_CONTRAST_CUTAWAY` M4 dogfood 校準**：M4 P4.2 收集 5 位測試者反饋
- **BASE_WALL_ALPHA 校準**：進 M11 rev.N ADR 集中處理
- **Shader-based alpha decay 升級**：M11+ 決定是否從 vertex color 升級為 `ShaderMaterial`
- **CVD automated check tooling**：LA3 e2e 於 M4 P4.1 review 時提供 CVD simulation lib 選型（Machado 2009 matrix 或既有 npm 套件）

## 6. 修訂紀錄 (Revision History)

- **rev.2**（2026-07-27 22:xx CST）— LA1 收斂 LA4/LA6/LA7 round 1 review findings（合併 1B / 8S / 8N，去重 3 對交叉）：
  - **B1 (LA6)** — §2.2 補明 `DEPTH_SEGMENTS=12` + `itemSize=4` color buffer + in-place BufferAttribute lifecycle；`smoothstep` 於 vertex interpolation 之低段密度失效已 close
  - **S1 (LA4) + N1 (LA7)** — §2.3.1 active fill `0.35` phantom → **`0.58`**（`piece-visual-rendering-brief` §3.1 首輪 playtest baseline）；citation 改引 §3.1
  - **S1 (LA6)** — §4.3 補 M4 fill-rate hard gate（>0.3 ms 或 >2% budget 自動 fallback）+ 明列 wall/locked/active/ghost `depthWrite` 政策
  - **S2 (LA6)** — §4.3 明列 context restore path 為 O(V) 且必須 in-place update；§2.2 補 `BufferAttribute` 生命週期規則
  - **S3 (LA6)** — §2.3.4 新增 `src/render/theme.ts` API contract（`RenderPreset` type / `getPreset` / `setPreset` / `subscribe` / cutaway 對應）；§2.3.3 `localStorage` 改為 versioned JSON `{ v: 2, renderPreset, highContrastCutaway }`
  - **S1 (LA7)** — §2.5 + §4.2 WCAG 對比 hard gate 改為 alpha-composited 最終畫素；最壞點修正為 `high-contrast` preset（BASE_WALL_ALPHA=0.15）
  - **S2 (LA7)** — §2.5 + §4.2 CVD 距離 hard gate 改為 alpha-composited 最終畫素
  - **S3/S4 (LA7)** + **N5 (LA4)** — §2.3.3 明訂 preset 走 ADR-0006 `SettingsSchema` v2（schema version bump per §2.8）；`renderPreset` / `highContrastCutaway` 為 zod enum / boolean 欄位
  - **S5 (LA7)** — §2.3.3 明列 codebase invariant：`renderPreset` / `highContrastCutaway` 僅能於 `src/render/*` 讀取，禁入 `fsm.step` / `replay-engine` / `adrHash` list
  - **S6 (LA7)** — §2.5 ARIA `role="status"` polite queue 由 ADR-0007 `ARIAAnnouncer` 集中批次化
  - **N1 (LA4)** — §2.2 `depthWrite:false` citation 改引 ADR-0001 §2.5 line 137
  - **N2 (LA4)** — §2.2 刪「vertex 序保留 ADR-0008 §2.2.4」偽引用，改內聯描述
  - **N3 (LA4)** — §2.3.2 明述 rim 為獨立幾何、cutaway 下不受影響
  - **N4 (LA4) + N2 (LA7)** — §2.5 明訂 preset switch 若加 CSS transition 動畫，須遵 `prefers-reduced-motion: reduce`
  - **N1 (LA6)** — §4.3 明列 4 wall Meshes 共用單一 material instance
  - **§4.5 residual** — orthographic camera-space Z 語意由 LA6 close；translucent 井底暗色 wash 併入 §4.2；新增 iGPU fill-rate + high-DPR banding 為 M4 verify item
  - Verified_clean（LA4 r1 × 10 項）不變，本 rev 不動：ADR-0008 §2.2.4 閉合 / renderOrder / replay determinism / ADR-0001 §2.5 不擴張 / 3° tilt 排除 / preset 值與 brief §3.7 一致 / SettingsSchema fallback 語意 / etc.
- **rev.1**（2026-07-27）— LA1 起草。基於：
  - LA8 `oab/design/well-visibility-comparison` A/B/C mockup（2026-07-24）
  - LA8 推薦：C default + B fallback
  - `oab/design/piece-visual-rendering-brief` §3.7 preset 系統
  - ADR-0008 §2.2.4 暫定閉合需求
  - 人類 2026-07-27 21:33 CST 指示「接受 LA8 建議，開始起草 ADR」
