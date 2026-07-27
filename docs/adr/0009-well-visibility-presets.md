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

- 狀態：Proposed（rev.1 draft — LA1 起草，待人類 + review agents 確認）
- 日期：2026-07-27
- 決策者：LA1 起草，待 LA4 (correctness) + LA6 (perf/forward) + LA7 (a11y/security) review 與人類 accept
- 相關文件：
  - ADR-0001 §2.5（renderOrder 分層、單一 `InstancedMesh`、alt-mode 相機家族）
  - **ADR-0008 §2.2.4**（井壁「暫定」— 本 ADR 為其**閉合 amend 對象**，見 §2.4 delta）
  - ADR-0008 §2.3.2（active / ghost / locked / warning 狀態視覺 — 本 ADR §2.3 引用）
  - ADR-0007 rev.3（React + Tailwind UI 疊層 — 本 ADR §2.5 A11y toggle 出口）
  - Brain: `oab/design/well-visibility-comparison`（LA8 mockup A/B/C 完整脈絡）
  - Brain: `oab/design/piece-visual-rendering-brief` §3.7（`translucent` / `high-contrast` / `opaque-fallback` preset 定義來源）
  - Brain: `oab/design/tetris-xl-well-shaft`（ADR-0008 mockup 上游 — 井道透視 + depth ring baseline）
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

**幾何 / 材質**：

- Wall 幾何仍為單一 `PlaneGeometry` × 4 面（後 / 左 / 右 / 前），vertex 序保留 ADR-0008 §2.2.4 暫定所述
- Alpha 值 bake 於 vertex color（`vertexColors: true`）或 shader uniform；MVP 傾向 vertex color 以避免 custom `ShaderMaterial`
- `depthWrite: false`（沿用 ADR-0008 §2.3.2 wall 慣例；避免半透明面互相 z-fighting）
- `renderOrder: 0`（沿用 ADR-0001 §2.5 wall < locked < ghost < active 排序）
- `transparent: true`

**與 Option A（完整透明井壁）之差**：A 為全牆同一 alpha 無 depth 淡化；本 ADR 之 C 靠 alpha decay 讓「玩家視角近端」自然消隱，避免 A 之疊色。

**與 Option B（前壁切開）之差**：B 為 hard cut，MVP 不做為 default；B 保留作 §2.3 `high-contrast` preset 的**選擇性 fallback**（見 §2.3.2）。

### 2.3 Preset 系統 — 三 preset 整合 `piece-visual-rendering-brief` §3.7 與 LA8 A/B/C

Renderer 提供**單一 `preset` token**，同時控制井壁 + 方塊透明策略。MVP UI 不強制暴露設定入口，但 preset token 必須存在於 `src/render/theme.ts`（或等價位置）作為 M6+ preset UI 的 forward-compat 接口。

#### 2.3.1 Preset 定義

| Preset | 井壁 | Active fill | Locked fill | Ghost | 對應 LA8 option |
|--------|------|-------------|-------------|-------|------------------|
| **`translucent`**（**default**） | §2.2 C 近端 fade（BASE_WALL_ALPHA=0.28） | ≈ 0.35（沿用 ADR-0008 §2.3.2） | opaque | dashed wireframe（ADR-0008 §2.3.2） | **C** |
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
- 保留後、左、右 3 面
- 該子選項預設 **OFF**；M4 dogfood playtest（見 §4.2）若發現 `high-contrast` 之 wall fade 對高堆疊仍不夠透明，才啟用該子選項並記錄於 `oab/decisions/well-cutaway-enable`

#### 2.3.3 Preset 儲存與 replay 不變性

- Preset 屬**本機 UI 偏好**，儲存於 `localStorage`（詳細鍵名 M7 定；本 ADR 只約束 replay 中立性）
- **禁止進入 replay header**（沿用 `piece-visual-rendering-brief` §3.7 最末段）
- **禁止影響**：collision、rotation、kick、score、game FSM
- 替換 preset 於 game FSM `RUNNING` 期間**允許**，但必須為 pure renderer swap（無 game-state 副作用）
- Load-time 若 `localStorage` 值不在 `{translucent, high-contrast, opaque-fallback}` 三 enum 內，fallback 為 `translucent`（不 throw）

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

### 2.5 A11y 對接（沿用 ADR-0008 §2.3.3 + `piece-visual-rendering-brief` §5）

- **WCAG 1.4.11 對比 ≥ 3:1**：井壁 outline / rim 對背景 + 相鄰 locked cell 必須驗證，尤其在 `translucent` alpha=0.28 時最脆弱
- **CVD 距離 ≥ 0.3**：wall alpha 變化不得使 locked palette 於 protanopia / deuteranopia / tritanopia 下疊色，M4 CVD automated check 涵蓋（見 §4.2）
- **顏色不是唯一識別**：wall fade **不得**替代 depth ring 作為深度線索；rim + depth ring 為 primary depth cue，wall alpha 為 supplementary
- **`prefers-reduced-motion`**：wall fade 為 static function of Z，本身不含 pulse / animation；無需 reduced-motion toggle
- **Preset UI 出口**：M6+ 若加入 Settings screen，preset switch 走 ADR-0007 rev.3 React + Tailwind DOM overlay；replay share 過程 preset 不寫入 header
- **ARIA live region**：preset 變更 announce 為 status（`role="status"`，polite）；不 interrupt gameplay

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

### 4.2 M4 verification acceptance（新增於本 ADR §4.2；LA3 e2e 需涵蓋）

- **視覺 case**：
  - 空井道於 `translucent` / `high-contrast` / `opaque-fallback` 三 preset 之 screenshot diff
  - 堆疊井底於三 preset 之 locked cell 辨識（自動 CV：locked cell 中心 alpha ≥ 0.85）
  - `high-contrast` + `HIGH_CONTRAST_CUTAWAY=true` 前壁裁切 case
- **CVD automated check**：三 preset × 3 CVD 模擬（prot/deuter/trit）× 兩隨機 stack seed，全部通過 ADR-0008 §2.3.3 CVD ≥ 0.3
- **DPR pixel test**：wall alpha decay 於 DPR ∈ {1, 1.5, 2, 3} 之邊界 pixel 不出現 ≥ 1 CSS px 的 aliasing artifact
- **Preset switch replay 中立性**：同一 seed + 同一 input sequence，於三 preset 下產生**位元相同**的 replay bytes（沿用 ADR-0006 replay determinism）

### 4.3 對效能 (Performance)

- 井壁從「4 個 `LineSegments`」升級為「4 個 `Mesh` 帶 vertex color alpha」：draw call 依然 = 4，per-frame allocation = 0（vertex color 於 setup 時 bake）
- Alpha blend 增加 GPU fragment cost；MVP 場景（5×5×12 = 60 max locked + active + ghost + 4 wall + 13 ring）估 <1% GPU frame budget（LA6 review 需確認）
- WebGL context restore：preset token 保存於 renderer 記憶體；context restore 後 re-bake vertex color 即可，`localStorage` 值無需重讀

### 4.4 對 ADR-0008 之 delta

- **ADR-0008 §2.2.4 rev.5 amend**（本 ADR merge 後同步）：
  - 移除「暫定」標記
  - 內容替換為「井壁 rendering 見 ADR-0009 §2.2、preset 系統見 ADR-0009 §2.3」
  - ADR-0008 §6 修訂欄新增 rev.5 條目
- **ADR-0001 §2.5 不受影響**：本 ADR 不涉及 renderOrder / InstancedMesh / camera tilt

### 4.5 未決風險與 M4 verification 條款

- **BASE_WALL_ALPHA = 0.28 未經 dogfood 校準**：M4 P4.2 dogfood 需記錄，若堆疊井底辨識 < 90%（`piece-visual-rendering-brief` §5.2 criteria），M11 rev.2 tune
- **前壁裁切 UX 感受不明**：`HIGH_CONTRAST_CUTAWAY=true` 於 M4 dogfood 為 opt-in 測試；至少 2 位測試者體驗後回饋
- **camera-space Z 於 orthographic camera 之語意**：ADR-0008 §2.2.4 傾向 `OrthographicCamera`；orthographic 之「camera-space Z」為線性、非透視 depth；`FADE_NEAR`/`FADE_FAR` 於 orthographic 下需以 orthographic near/far plane 為基準（M4 實作時 LA6 需 double-check）
- **`translucent` preset 於 alpha=0.28 之井底暗色 wash**：低亮度 room 或深色 monitor 上可能整體偏暗；A11y §2.5 對比檢查為此 gate

## 5. 後續行動 (Follow-ups)

- **本 ADR merge 後同步 amend ADR-0008 rev.5**：LA1 一同 PR，或另發 delta PR（傾向同 PR，減少 hash bump 次數）
- **3° 近垂直 alt-mode tilt**（LA8 於 `oab/design/top-down-z-view` 提出，待人類另決）：**本 ADR 不含**；建議另立 ADR-0010（camera tilt 家族）或 ADR-0008 rev.5 之獨立 amendment
- **Preset UI 出口**（Settings screen）：延到 M6+（HUD milestone），走 ADR-0007 rev.3 React + Tailwind
- **`HIGH_CONTRAST_CUTAWAY` M4 dogfood 校準**：M4 P4.2 收集 5 位測試者反饋
- **BASE_WALL_ALPHA 校準**：進 M11 rev.N ADR 集中處理
- **Shader-based alpha decay 升級**：M11+ 決定是否從 vertex color 升級為 `ShaderMaterial`
- **CVD automated check tooling**：LA3 e2e 於 M4 P4.1 review 時提供 CVD simulation lib 選型（Machado 2009 matrix 或既有 npm 套件）

## 6. 修訂紀錄 (Revision History)

- **rev.1**（2026-07-27）— LA1 起草。基於：
  - LA8 `oab/design/well-visibility-comparison` A/B/C mockup（2026-07-24）
  - LA8 推薦：C default + B fallback
  - `oab/design/piece-visual-rendering-brief` §3.7 preset 系統
  - ADR-0008 §2.2.4 暫定閉合需求
  - 人類 2026-07-27 21:33 CST 指示「接受 LA8 建議，開始起草 ADR」
