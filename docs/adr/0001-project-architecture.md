# ADR-0001: Tetris-XL 專案架構決策

- 狀態：Accepted
- 日期：2026-07-22
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
| 3D 渲染 | **three.js** (r160+) | 生態成熟、文件豐富、對 WebGL2 抽象良好，符合需求指定 |
| 建置工具 | **Vite** | 快速 HMR、原生 ESM、對 TS 支援佳 |
| 語言 | **TypeScript (strict)** | 遊戲邏輯型別繁複（座標、旋轉矩陣、狀態機），靜態型別可降低錯誤 |
| 狀態管理 | 自製有限狀態機 (FSM) + 事件匯流排 | 遊戲狀態單純且高頻，避免引入 Redux 等過度抽象 |
| UI 疊層 | **React 18** + Tailwind CSS | 選單、HUD、設定頁與 3D canvas 分離；React 元件負責 DOM 疊層 |
| 3D 整合 | 手寫 three.js `Scene`，**不**採用 R3F | 遊戲主迴圈需精準控制 tick / render 順序，宣告式包裝反而增加負擔 |
| 音效 | Web Audio API（薄封裝） | 低延遲、無需第三方依賴 |
| 測試 | Vitest（單元）、Playwright（E2E 煙霧測試） | 與 Vite 原生整合 |
| Lint / Format | ESLint + Prettier | 業界標準 |
| CI | GitHub Actions | 執行 typecheck、lint、unit test、build |
| 部署 | 靜態網站（Cloudflare Pages / GitHub Pages） | 純前端，無伺服端狀態 |

### 2.2 座標系與資料模型

- 採**右手座標系**，`+Z` 指向井口上方（即方塊下落方向為 `-Z`）。
- 場地以 3D 陣列 `Uint8Array` 表示，長度 `5 * 5 * 12 = 300`，索引函式 `idx(x, y, z) = x + y*5 + z*25`。使用 typed array 保證記憶體連續、GC 友善。
- 每個 cell 值：`0` 為空，`1..N` 對應方塊顏色 / 類型 ID。
- Piece 內部以 `Int8Array` 儲存 4 個 cell 的相對座標 `[dx, dy, dz]`，最多 4 cell × 3 = 12 個 int8。
- 旋轉以預先計算之**旋轉狀態表 (SRS-like rotation states)** 儲存，每個 piece 型態最多 24 種 3D 方向；避免每 tick 進行矩陣乘法。

### 2.3 方塊 (Polycube) 集合

- 內建集合以枚舉方式定義，載入時展開為所有唯一旋轉狀態（以正規化字串為鍵去重）。
- 出牌採 **7-bag 變體**：以「1-cell、2-cell、3-cell、4-cell」四個桶為權重的加權亂數袋，預設權重 `[5%, 15%, 30%, 50%]`，可於難度設定調整。此權重與難度曲線於後續 ADR 再議。

### 2.4 遊戲迴圈 (Game Loop)

- 採「固定邏輯步長 + 可變渲染」架構：
  - 邏輯 tick：固定 `60 Hz`（`~16.67 ms`），處理輸入、重力、鎖定、消除。
  - 渲染：`requestAnimationFrame`，於兩次 tick 之間以 α 內插插值方塊位置，維持流暢動畫。
- 重力速度依關卡遞增，鎖定延遲 (`lockDelay`) 預設 500 ms，允許 15 次移動 / 旋轉重置。

### 2.5 渲染策略

- **一個 `InstancedMesh`** 管理所有已鎖定 cell（上限 300 個實例），避免大量 draw call。
- 當前活動方塊以獨立 `Group` 表示，便於旋轉動畫與陰影投影。
- 「著陸預覽 (ghost piece)」以半透明 wireframe 顯示於落點位置。
- 井壁採用半透明材質 + `EdgesGeometry` 描邊，兼顧深度感與可視性。
- 相機預設為輕微傾斜的俯視角（約 20° pitch），可切換為純垂直俯視；不採自由軌道相機以避免玩家迷失方向。

### 2.6 輸入 (Input)

- 鍵盤為主：方向鍵 X/Y 平移、`Q/E/W/S/A/D` 對應三軸旋轉、`Space` 硬降、`Shift` 保留 (hold)。
- 支援 gamepad（Web Gamepad API），行動裝置以觸控疊層按鈕。
- 所有輸入透過中央 `InputMapper` 標準化為抽象 `GameAction`，方便重綁與重播。

### 2.7 消除邏輯

1. 方塊鎖定後，掃描其涵蓋之所有 Z 層。
2. 對每一層檢查 25 格是否皆非零。
3. 收集所有滿層，一次性以動畫（發光 → 收縮 → 消失，約 300 ms）呈現。
4. 動畫結束後，將上方所有層以「memcpy 式」複製下移，頂層補 0。
5. 計分採「同時消除層數階梯」：1/2/3/4 層分別給予 `100 / 300 / 700 / 1500` 基礎分乘以關卡倍率。

### 2.8 專案結構（初版）

```
src/
  main.ts                # 入口
  app/                   # React UI 疊層（選單、HUD）
  engine/
    core/                # 遊戲迴圈、FSM、事件匯流排
    board/               # 場地資料結構、消除演算法
    pieces/              # Polycube 定義、旋轉狀態產生
    rng/                 # 加權 bag RNG
    input/               # InputMapper、鍵位設定
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
- **React Three Fiber (R3F)**：宣告式寫法對 UI 場景友好，但遊戲主迴圈受 React reconciler 影響難以精確控制 tick，且效能監控較不透明。UI 部分仍採 React，但 3D 場景手寫。
- **PixiJS + 偽 3D**：以 2D 精靈模擬 3D 井道，效能佳但視覺表現與擴充性受限，違背「現代 3D」目標。
- **Unity WebGL / Godot Web export**：交付體積大（>10 MB）、載入慢，且對純網頁生態整合較差。
- **Redux / Zustand 管理遊戲狀態**：遊戲狀態每 tick 高頻變更，與 React 響應式模型不匹配，改用純資料 + FSM 更適合。

## 4. 影響 (Consequences)

### 正面
- three.js + Vite + TS 的組合啟動快速、社群資源豐富，招募與維護成本低。
- 固定 tick + InstancedMesh 讓效能上限充裕，5×5×12 場地在中階筆電應可穩定 120 fps。
- ADR 明確劃分「UI (React)」與「Game (手寫 three.js)」邊界，避免職責混淆。

### 負面 / 風險
- 手寫遊戲迴圈與 3D 場景意味著較多樣板程式碼；需以清晰的模組界線與型別控管彌補。
- 3D 旋轉 UX 是本作最大不確定性，需在原型階段以玩家測試驗證預設鍵位與旋轉軸方向。
- 行動裝置觸控操作 3D 旋轉體驗較差，行動端首版可能僅支援觀戰 / 簡化控制。

## 5. 後續行動 (Follow-ups)

- ADR-0002：Polycube 集合完整枚舉與旋轉正規化演算法。
- ADR-0003：難度曲線、重力表與 bag 權重。
- ADR-0004：3D 輸入 UX 與鍵位對照。
- 建立 `spike/` 分支製作最小可玩原型 (MVP)：只有 1-cell 與 I-tetracube，用於驗證迴圈、渲染與消除。
