# ADR-0001: Tetris-XL 專案架構決策

- 狀態：Accepted（rev.4 · **final**）
- 日期：2026-07-22
- 修訂：2026-07-22（rev.2 — 依 LA5 round 1 review 補齊 B1–B3 與部分 S/N；rev.3 — 自我 review 清理 3 nit；rev.4 — 依 LA5 round 2 review 修 New-B1 + piggyback New-S1/S2/N1/N2）
- 決策者：專案發起團隊
- 相關文件：README.md

## 1. 背景 (Context)

Tetris-XL 是一款以現代網頁技術實作的 3D 俄羅斯方塊遊戲。與傳統 2D 俄羅斯方塊不同，本作以「豎井式 (shaft / well)」透視為主要視角：玩家由上往下俯瞰一個垂直方形井道，方塊由井頂落下，玩家可在下墜過程中沿 X/Y 軸平移並繞三軸旋轉。

主要遊戲參數：

- 遊戲場尺寸：`5 × 5 × 12`（X × Y × Z，Z 為垂直深度）
- 方塊 (Piece) 組成：由 1 至 4 個單位立方體 (unit cube / cell) 連接而成的 polycube
  - 1-cell：monocube
  - 2-cell：dicube
  - 3-cell：tricube（L 型、直線）
  - 4-cell：tetracube（含平面與立體型態，例：I、L、T、S、Z、Square、Tower、Tripod 等）
- 消除規則：任一水平層 (Z=k 平面，5×5=25 格) 完全填滿即消除該層，其上方層向下遞補
- 目標平台：現代桌機瀏覽器（Chromium、Firefox、Safari 最新兩個大版本），行動裝置為次要支援

本 ADR 記錄早期關鍵技術決策，作為後續實作與擴充的基準。

## 2. 決策 (Decision)

### 2.1 技術棧 (Tech Stack)

| 層級 | 選型 | 理由 |
|------|------|------|
| 3D 渲染 | **three.js** r160 系列（package.json 指定 `~0.160.0`，等效 `>=0.160.0 <0.161.0`） | 生態成熟、文件豐富、對 WebGL2 抽象良好，符合需求指定；lockfile 必交 |
| 建置工具 | **Vite** | 快速 HMR、原生 ESM、對 TS 支援佳 |
| 語言 | **TypeScript (strict)** | 遊戲邏輯型別繁複（座標、旋轉矩陣、狀態機），靜態型別可降低錯誤 |
| 狀態管理 | 自製有限狀態機 (FSM) + 事件匯流排（**匯流排僅用於 UI 邊界**） | 遊戲狀態單純且高頻；tick path 走純函式 / 直接呼叫，bus 只跨越「Game → UI」（score、line-clear、game-over 等通知） |
| UI 疊層 | **MVP 採 vanilla DOM overlay**；若後續選單/設定膨脹再引入 React 18 + Tailwind | 首版 HUD/選單簡單，vanilla 足夠且無 bridge 複雜度；spike 期間刻意排除 React，驗證迴圈與渲染後再議 |
| 3D 整合 | 手寫 three.js `Scene`，**不**採用 R3F | 遊戲主迴圈需精準控制 tick / render 順序，宣告式包裝反而增加負擔 |
| 音效 | Web Audio API（薄封裝） | 低延遲、無需第三方依賴 |
| 測試 | Vitest（單元）、Playwright（E2E 煙霧測試） | 與 Vite 原生整合 |
| Lint / Format | ESLint + Prettier | 業界標準 |
| CI | GitHub Actions | 執行 typecheck、lint、unit test、build |
| 部署 | 靜態網站（Cloudflare Pages / GitHub Pages） | 純前端，無伺服端狀態 |

### 2.2 座標系與資料模型

- 採**右手座標系**。`+Z` 指向井口上方，`-Z` 為方塊下落方向。
- **軸範圍明確化**：
  - `x ∈ [0, 4]`、`y ∈ [0, 4]`、`z ∈ [0, 11]`
  - **`z = 0` 為井底**（消除後上方層下移的目的地）
  - **`z = 11` 為井口頂**（spawn 高度基準）
- 場地以 `Uint8Array` 表示，長度 `5 * 5 * 12 = 300`，索引函式 `idx(x, y, z) = x + y*5 + z*25`。使用 typed array 保證記憶體連續、GC 友善。
- 每個 cell 值：`0` 為空，`1..N` 對應方塊顏色 / 類型 ID。
- **Piece 資料結構**：
  ```ts
  interface Piece {
    typeId: u8;              // 對應顏色 / 類型
    cellCount: u8;           // 1..4，實際佔用格數
    cells: Int8Array;        // 長度固定 12 (4 cell × 3 axis)，未使用槽以哨兵 0x7F 標記
    origin: Int8Array;       // [ox, oy, oz]，旋轉樞紐（相對 piece anchor）
    rotationStateId: u8;     // 指向該 typeId 之預先展開旋轉表 index
  }
  ```
  - **`cellCount` 為權威來源**，碰撞檢測僅迭代 `cells.subarray(0, cellCount*3)`，避免讀到哨兵/垃圾偏移。
- 旋轉以預先計算之**旋轉狀態表**儲存。每個 piece typeId 於載入時展開所有唯一旋轉（以正規化字串為鍵去重，上限為立方體旋轉群 24 種，實際多因對稱更少）。tick 時只查表切換 `rotationStateId`，不做即時矩陣乘法。
- **Wall-kick / floor-kick**：旋轉若與場地或井壁碰撞，依 `origin` 附近的偏移列表 `[(±1,0,0), (0,±1,0), (0,0,+1), ...]` 嘗試位移；全部失敗則保留原態。完整偏移表於 ADR-0002 定義。

### 2.3 方塊 (Polycube) 集合

- 內建集合以枚舉方式定義，載入時展開為所有唯一旋轉狀態（以正規化字串為鍵去重）。
- 出牌採 **7-bag 變體**：以「1-cell、2-cell、3-cell、4-cell」四個桶為權重的加權亂數袋，預設權重 `[5%, 15%, 30%, 50%]`，可於難度設定調整。此權重與難度曲線於後續 ADR 再議。

### 2.4 遊戲迴圈 (Game Loop)

- 採「固定邏輯步長 + 可變渲染」架構：
  - 邏輯 tick：固定 `60 Hz`（`~16.67 ms`），處理輸入、重力、鎖定、消除。
  - 渲染：`requestAnimationFrame`，於兩次 tick 之間以 α 內插插值方塊位置，維持流暢動畫。
- 重力速度依關卡遞增（速度表於 ADR-0003）。

#### 2.4.1 FSM 狀態與轉移

```
BOOT → READY → SPAWN → FALLING → GROUNDED → LOCKED ─┬─ (clearedLayers > 0) → CLEARING → SPAWN
                                                     └─ (clearedLayers == 0) ──────────→ SPAWN
                                                             ↘ GAME_OVER
```

| 狀態 | 進入條件 | 離開條件 |
|------|----------|----------|
| `SPAWN` | 上個 piece 已結算 | 生成新 piece 於預設位置 |
| `FALLING` | Spawn 成功且未觸地 | 重力累積 ≥ `gravityStep` → 下移一格 |
| `GROUNDED` | Piece 有任一 cell 的下一位置越界或被佔用：`z-1 < 0` 或 `board[idx(x, y, z-1)] != 0` | (a) `lockDelay` 到 → `LOCKED`；(b) 玩家移動/旋轉成功 → 續留 `GROUNDED`，計數重置；(c) 硬降 → 立即 `LOCKED` |
| `LOCKED` | `GROUNDED` 逾時或硬降 | Piece cell 寫入場地後執行 §2.7 步驟 1–2 掃描；若 `clearedLayers.length > 0` → `CLEARING`，否則直接 → `SPAWN`（避免空跑動畫幀） |
| `CLEARING` | 有滿層需消除 | 動畫結束並下移完畢 → `SPAWN` |
| `GAME_OVER` | 見 §2.4.3 | 玩家重開 → `BOOT` |

#### 2.4.2 Lock Delay 完整規則

- 進入 `GROUNDED` 時啟動計時器（預設 `500 ms`）。
- **成功**的移動 / 旋轉（碰撞檢測通過的動作）可 reset 計時器，最多 **15 次**。失敗的動作不計。
- 15 次 reset 用盡後強制 lock，忽略後續 reset。
- 若 `GROUNDED` 期間 piece 因玩家操作再度脫離地面，重回 `FALLING`：**reset 次數保留**（不歸零），計時器歸零並待再次觸地。
- **硬降 (`Space`)**：直接跳至最終落點並立即 `LOCKED`，忽略 `lockDelay` 與 reset 計數。

#### 2.4.3 Game Over（Top-out）條件

Spawn / lock 兩階段各一條件，實作時可收於同一「非法佔位判定」函式：

1. **Spawn blocked**（含 spawn-kick 嘗試）：`SPAWN` 生成新 piece 時執行碰撞檢查；若原位失敗，依 **spawn-kick 偏移列表**嘗試位移；**全部失敗**即 game over。（即 well 頂已無合法容納空間。）
   - **spawn-kick 與旋轉 wall/floor-kick 為不同表**：spawn-kick 不應含 `(0, 0, +1)` 這類把 piece 推出井外的偏移；完整偏移表與差異定義歸 ADR-0002。spike 期間 spawn-kick 預設為空表（僅檢查原位）。
2. **Above-ceiling lock**（防禦性）：`LOCKED` 寫入 board 前，若 piece 尚有任一 cell 位於 `z > 11`，代表 well 溢出 → game over。理論上經嚴格 spawn 前置檢查後不應發生，保留此條件作為 invariant guard。

#### 2.4.4 Spawn 定位

- 新 piece 錨點放置於 `(x=2, y=2, z=11)`（井口中心）。
- **Spawn 緩衝區**：piece 的 local +z cell 可暫時位於 `z ∈ [12, 11 + pieceMaxDz]`（例如 4-cell tower 型 `pieceMaxDz=3` 時可達 `z=14`）。
- **重要不變式**：緩衝區的 cell 只存在於 `Piece` 物件（`cells` + 平移量），**永不寫入 board `Uint8Array`**（board 索引僅覆蓋 `z ∈ [0, 11]`，長度 300）。渲染時透過活動方塊 `Group` 直接繪製，不查 board。
- Piece 每次下移一格後，只要所有 cell 進入 `z ∈ [0, 11]` 且無碰撞即進入正常 `FALLING`；若首次下移前碰撞檢查即失敗且 kick 全數失敗，觸發 §2.4.3 條件 1。

### 2.5 渲染策略

- **一個 `InstancedMesh`** 管理所有已鎖定 cell（上限 300 個實例），避免大量 draw call。
- 當前活動方塊以獨立 `Group` 表示，便於旋轉動畫與陰影投影。
- 「著陸預覽 (ghost piece)」以半透明 wireframe 顯示於落點位置。
- 井壁採用半透明材質 + `EdgesGeometry` 描邊，兼顧深度感與可視性。
- 相機預設為輕微傾斜的俯視角（約 20° pitch），可切換為純垂直俯視；不採自由軌道相機以避免玩家迷失方向。
- **透明度 / 深度**：ghost、井壁、活動件三者同框時 three.js 深度排序容易產生噪訊。spike 階段策略：
  - 井壁：`transparent:true, depthWrite:false, renderOrder:0`
  - 已鎖定 InstancedMesh：`renderOrder:1`（不透明優先）
  - Ghost：`transparent:true, depthWrite:false, renderOrder:2`
  - 活動方塊：`renderOrder:3`
  - 若視覺仍紊亂，改用簡易 x-ray shader 或 additive blending 突顯落點，避免玩家誤判。

### 2.6 輸入 (Input)

- 鍵盤為主：方向鍵 X/Y 平移、`Q/E/W/S/A/D` 對應三軸旋轉、`Space` 硬降、`Shift` 保留 (hold)。
- 支援 gamepad（Web Gamepad API），行動裝置以觸控疊層按鈕。
- 所有輸入透過中央 `InputMapper` 標準化為抽象 `GameAction`，方便重綁與重播。

### 2.7 消除邏輯

1. 方塊鎖定後，掃描 `z ∈ [0, 11]` **全部 12 個水平層**。
   - 註：於「整層 `copyWithin` 下移、無 cell-level gravity」模型下（見步驟 4），滿層只可能因「本次 lock 寫入」產生，故理論上可優化為只掃 piece 涵蓋層；但差異僅 O(300) − O(3×25) ≈ 一位數 µs，MVP 一律全掃以避免與步驟 5 產生語意風險。
2. 對每一層檢查 25 格是否皆非零。
3. 收集所有滿層（`clearedLayers: number[]`），一次性以動畫（發光 → 收縮 → 消失，約 300 ms）呈現。若 `clearedLayers.length === 0`，跳過本步驟與步驟 4（見 §2.4.1 FSM 短路轉移）。
4. 動畫結束後，將 `clearedLayers` 由高到低移除，並以 `Uint8Array.prototype.copyWithin` 將上方層向下遞補：
   ```ts
   // 由低索引往高索引方向掃描，逐一將 (z_src) 複製到 (z_dst)
   // copyWithin 對重疊區間定義明確：source 讀完再寫，故單向搬移安全
   ```
   頂層以 `fill(0, topStart, topEnd)` 補零。
5. **不做連鎖再掃描，且不延後滿層**：每次 lock 只結算一輪。
   - **在步驟 4 的「整層下移」模型下**，compaction 本身**不會產生新的滿層**（下移的整層若不曾滿，下移後也不會滿），因此無需、也不應在下移後再掃。
   - 明確不採「留待下次 lock 再判定」的延後策略——若配上步驟 1 的窄掃會造成永久殘留滿層（見 rev.4 修訂紀錄 New-B1）。
   - 未來若改為 cell-level gravity（例如允許漂浮方塊各自落下），本節須同步改寫：下移後全板重掃，或維護 `pendingFullLayers` 佇列，**不得**依賴「下次 lock + 只掃 piece 層」。
6. **計分**（同時消除層數階梯，`n = min(clearedLayers.length, 4)`）：

   | 同時消除層數 (n) | 基礎分 |
   |------------------|--------|
   | 1 | 100 |
   | 2 | 300 |
   | 3 | 700 |
   | 4 | 1500 |
   | ≥ 5 | 以 n=4 封頂（實作以 `Math.min(n, 4)` 索引） |

   理論上單次 lock 最多可清 4 層（4-cell piece 最大 z 跨度），因此 `≥5` 為防禦性封頂；若後續調整 piece 或引入垂直清層，需回頭修訂本表（追至 ADR-000x「計分細節」）。基礎分乘以關卡倍率（ADR-0003 定義）。

### 2.8 專案結構（初版）

```
src/
  main.ts                # 入口
  app/                   # UI 疊層（首版 vanilla DOM；後續可能引入 React）
  engine/
    types/               # 座標、GameAction、Piece 等共用型別
    core/                # 遊戲迴圈、FSM、tick 純函式
    board/               # 場地資料結構、消除演算法
    pieces/              # Polycube 定義、旋轉狀態產生
    rng/                 # 加權 bag RNG
    input/               # InputMapper、鍵位設定
    events/              # 對 UI 邊界的事件匯流排（僅跨層通知）
  render/
    scene.ts             # three.js Scene 組裝
    board-renderer.ts    # InstancedMesh 場地渲染
    piece-renderer.ts    # 活動方塊與 ghost
    camera.ts            # 相機控制
  audio/
  assets/
  styles/
tests/
  unit/
  e2e/
docs/
  adr/
```

## 3. 已考慮的替代方案 (Alternatives Considered)

- **Babylon.js**：功能更全面（含物理、GUI），但套件較重，且本作不需複雜物理與內建 GUI，three.js 更輕量。
- **React Three Fiber (R3F)**：宣告式寫法對 UI 場景友好，但遊戲主迴圈受 React reconciler 影響難以精確控制 tick，且效能監控較不透明。3D 場景手寫；UI 疊層 MVP 走 vanilla，後續若複雜再引入 React（見 §2.1）。
- **PixiJS + 偽 3D**：以 2D 精靈模擬 3D 井道，效能佳但視覺表現與擴充性受限，違背「現代 3D」目標。
- **Unity WebGL / Godot Web export**：交付體積大（>10 MB）、載入慢，且對純網頁生態整合較差。
- **Redux / Zustand 管理遊戲狀態**：遊戲狀態每 tick 高頻變更，與 React 響應式模型不匹配，改用純資料 + FSM 更適合。

## 4. 影響 (Consequences)

### 正面
- three.js + Vite + TS 的組合啟動快速、社群資源豐富，招募與維護成本低。
- 固定 tick + InstancedMesh 讓效能上限充裕，5×5×12 場地在中階筆電應可穩定 120 fps。
- FSM 狀態與 top-out 條件在 ADR 層即定義完畢，實作可直接依表寫測試。
- MVP 排除 React / Tailwind / 音效等次要面，讓 spike 專注於迴圈與 3D 渲染核心。

### 負面 / 風險
- 手寫遊戲迴圈與 3D 場景意味著較多樣板程式碼；需以清晰的模組界線與型別控管彌補。
- 3D 旋轉 UX 是本作最大不確定性，需在原型階段以玩家測試驗證預設鍵位與旋轉軸方向；ADR-0004 前於 spike 限制為兩軸旋轉 + 一鍵翻轉。
- 井深僅 12 且 4-cell piece 旋轉幾何體積大，wall/floor-kick 表若不完整將導致大量無效旋轉；ADR-0002 為關鍵瓶頸。
- 行動裝置觸控操作 3D 旋轉體驗較差，行動端首版可能僅支援觀戰 / 簡化控制。
- 「不做連鎖再掃描」的取捨簡化 FSM 但犧牲少見情境下的華麗連擊；後續若玩家測試回饋失落感明顯，需回頭修訂 §2.7。

## 5. 後續行動 (Follow-ups)

- ADR-0002：Polycube 集合完整枚舉、旋轉正規化與 wall-kick / floor-kick 偏移表。
- ADR-0003：難度曲線、重力表與 bag 權重。
- ADR-0004：3D 輸入 UX 與鍵位對照（spike 期先試「兩軸旋轉 + 一鍵翻轉」，勿過早鎖 6 鍵映射）。
- ADR-0005：計分細節（連擊、T-spin 類 3D 變體、關卡倍率公式）。
- ADR-0006（條件觸發）：持久化與重播格式。**若引入 `localStorage` / URL query state：**
  - 一律以 schema (zod 或等價) 驗證讀入資料。
  - 設定每欄長度上限；重播序列總長度上限。
  - **禁止 `eval`、`Function` 動態執行任何字串來源**。
  - CI 建置環境不注入無謂 token 到靜態成品。
- 建立 `spike/` 分支製作最小可玩原型 (MVP)：只有 1-cell 與 I-tetracube，用於驗證迴圈、渲染與消除。MVP 明確**不含** React、Tailwind、音效、Gamepad、持久化。


## 6. 修訂紀錄 (Revision History)

### rev.4 — 2026-07-22（final round）
依 LA5 round 2 review 修訂：

- **New-B1 (Blocking) → §2.7 步驟 1、5**：修正「窄掃 × 延後滿層」的邏輯矛盾。
  - 步驟 1 改為全高 12 層掃描（附優化註解，說明何時可退回窄掃）。
  - 步驟 5 強化語意：整層 `copyWithin` 下移模型下 compaction 不會產生新滿層；**刪除**「留待下次 lock 再判定」的延後策略；並註明若改 cell-level gravity 須連動修訂。
- **New-S1 (Should) → §2.4.1 FSM**：`LOCKED` 依 `clearedLayers.length` 條件轉移，`== 0` 直接跳 `SPAWN`，避免空跑 CLEARING 動畫。
- **New-S2 (Should) → §2.4.3**：明訂 spawn-kick 表與旋轉 wall/floor-kick **不共用**，spike 期 spawn-kick 預設為空表；完整偏移表歸 ADR-0002。
- **New-N1 (Nit) → §6 rev.2 紀錄**：修正對 B1 的敘述，改為指向 rev.3 之兩條件收斂。
- **New-N2 (Nit) → §2.4.1 GROUNDED**：條件敘述改為明確的 `z-1 < 0` 或 `board[idx(x,y,z-1)] != 0`，避免「下一格為場地或 z=0」被誤讀。

**verdict**：本輪為 ADR-0001 final review；後續變更以新 ADR 進行。

### rev.3 — 2026-07-22
自我 review 清理 3 nit：

- **§2.1**：three.js 版本標記從口語化的「`^0.160.0` 以下釘死大版」改為明確的 `~0.160.0`（等效 `>=0.160.0 <0.161.0`）。
- **§2.4.3**：合併重疊的 spawn / no-legal-spawn 條件為單一「Spawn blocked（含 kick 嘗試）」；`Above-ceiling lock` 明確定位為 invariant guard。從三條收斂為兩條，實作可收於同一函式。
- **§2.4.4**：新增「Spawn 緩衝區的 cell 永不寫入 board `Uint8Array`」不變式，避免 `pieceMaxDz` 造成越界誤解；補充首次下移碰撞邏輯。

### rev.2 — 2026-07-22
依 LA5 review round 1 修訂：

- **B1 → §2.4.3 / §2.4.4**：定義 Game Over 條件與 Spawn 定位規則（rev.2 為三條件；rev.3 已收斂為兩條件）。
- **B2 → §2.4.2**：完整定義 `lockDelay` 時機、reset 條件、上限、脫離地面與硬降互動。
- **B3 → §2.7 步驟 5**：明訂「每次 lock 僅結算一輪清除，下移後不連鎖」。
- **S1 → §2.1 / §3 / §5**：UI 疊層降級為 MVP vanilla，React 改為條件性後續選項；spike 明確排除 React。
- **S2 部分 → §2.2**：新增 `origin` 樞紐欄位、wall/floor-kick 概念與失敗保留原態；細節推至 ADR-0002。
- **S3 → §2.2**：Piece 加入 `cellCount` 權威欄位、哨兵值 `0x7F`、碰撞檢測只迭代有效槽。
- **S4 → §2.2**：明示 `z=0` 井底 / `z=11` 井頂。
- **S5 → §2.7 步驟 6**：計分表 `Math.min(n, 4)` 封頂，並註記回頭修訂條件。
- **S6 → §4 負面 / §5 ADR-0004**：spike 前限制為兩軸旋轉 + 一鍵翻轉。
- **S7 → §2.1 / §2.8**：事件匯流排明訂僅用於 UI 邊界；tick path 走純函式。
- **S8 → §5 ADR-0006 條件觸發項**：持久化 / 重播的 schema 驗證、長度上限、禁 `eval`、CI 不注入 token。
- **N1 → §2.1**：three.js 釘死 r160 系列大版，lockfile 必交。
- **N2 → §2.7 步驟 4**：明訂使用 `copyWithin`，方向與 z 軸一致。
- **N3 → §2.5**：新增透明度 / 深度排序策略（renderOrder + `depthWrite:false`）。
- **N5 → §2.8**：新增 `engine/types/` 共用型別目錄。
- **N6 → §5**：Follow-up 新增 ADR-0005 計分細節、ADR-0006 持久化 / 重播（含 S8 硬性要求）。

**未採用 / 延後**：
- S2 完整 wall-kick 偏移表（範圍屬 ADR-0002，本 ADR 僅留概念）。
- N4 均勻 bag（屬 ADR-0003）。
