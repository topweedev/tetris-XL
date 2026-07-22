---
title: ADR-0003 Difficulty Curve, Gravity Table, Bag Weights and Level Multiplier
type: decision
status: accepted
adr_id: "0003"
repo: topweedev/tetris-XL
path: docs/adr/0003-difficulty-and-scoring.md
tags: [adr, tetris-xl, difficulty, gravity, bag, scoring, level]
---

# ADR-0003: 難度曲線、重力表、Bag 權重與關卡倍率

- 狀態：Accepted
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：ADR-0001（rev.4）§2.3 / §2.4 / §2.4.1 / §2.4.2 / §2.7、ADR-0002（rev.3）§2.7

## 1. 背景 (Context)

ADR-0001 rev.4 定義的難度相關參數留白：

- §2.4：「重力速度依關卡遞增（速度表於 ADR-0003）」
- §2.4.1 FSM：`FALLING` 使用 `gravityStep`（重力累積閾值），數值未定
- §2.4.2：`lockDelay` 預設 500 ms，15 次 reset 上限；是否隨關卡調整未定
- §2.3：7-bag 加權「`[5%, 15%, 30%, 50%]`（1/2/3/4-cell buckets），可於難度設定調整」— 難度層次未定
- §2.7 步驟 6：「基礎分乘以關卡倍率（ADR-0003 定義）」

本 ADR 補齊：

- **關卡系統**：升級條件、最大關卡
- **重力表**：每關卡的 `gravityStep`（以「tick 數 / 格」與毫秒兩種單位表達）
- **Lock delay 曲線**：`lockDelay` 隨關卡遞減（15-reset 上限保持不變）
- **Bag 權重曲線**：4 桶權重隨關卡調整
- **關卡分數倍率**：`finalScore = baseScore × levelMultiplier`
- **軟降 / 硬降計分**：ADR-0001 §2.7 步驟 6 未提及；本 ADR 補上

## 2. 決策 (Decision)

### 2.1 關卡系統 (Level System)

- **起始關卡**：`level = 1`
- **升級條件**：每累積清除 `5` 層 → `level += 1`（`totalLayersCleared` 為權威計數，於 §2.7 步驟 3 遞增）
- **最大關卡**：`level ≤ 20`（超過封頂，維持 L20 參數）
- **關卡狀態**：`level: u8` 存於 `GameState`，於 `LOCKED` → `SPAWN` 或 `CLEARING` → `SPAWN` 前依 `totalLayersCleared` 重算，避免中途動畫時漂移
- **軟重置**：`GAME_OVER` → `BOOT`（見 ADR-0001 §2.4.1）時 `level = 1`、`totalLayersCleared = 0`

**升級判定公式**：

```ts
const nextLevel = Math.min(20, 1 + Math.floor(totalLayersCleared / 5));
if (nextLevel !== state.level) {
  state.level = nextLevel;
  bus.emit('levelUp', { level: nextLevel });  // UI 邊界通知（見 ADR-0001 §2.1）
}
```

**設計取捨**：

- 「每 5 層升 1 級」在 5×5×12 井道下步調合理：滿板一次可清 12 層以內（多數情況下 4-cell dominated → 每 lock ~1 層），一次「玩到爆」約 10–15 級。
- **不採用「經驗值 / 分數」為升級條件**：分數受 combo / 關卡倍率放大，用它做升級會產生正回饋 loop（分越多、升越快、倍率越大），失控。層數為線性中性指標。

### 2.2 重力表 (Gravity Table)

**單位定義**：

- `gravityStep` = 兩次「piece 下移一格」之間所需的 tick 數（tick = 1/60 秒 ≈ 16.67 ms，見 ADR-0001 §2.4）
- 對應時間 `t = gravityStep × 16.67 ms`
- 特例：`gravityStep = 1` 表示每 tick 下移一格（≈ 60 格 / 秒），為本 ADR 定義的最快速度
- **無 20G**：不採「單一 tick 內連續下移到底」的 sub-tick gravity。5×5×12 井道深度僅 12，L20 的 1 tick/格 已能於 200 ms 內落到底；20G 帶來的實作複雜度（sub-tick collision、lockDelay 語意變更）不合成本

**表**：

| level | gravityStep (ticks) | ≈ 時間 (ms) | ≈ 格 / 秒 |
|-------|---------------------|-------------|-----------|
| 1  | 60 | 1000 | 1.00 |
| 2  | 48 |  800 | 1.25 |
| 3  | 37 |  617 | 1.62 |
| 4  | 28 |  467 | 2.14 |
| 5  | 21 |  350 | 2.86 |
| 6  | 16 |  267 | 3.75 |
| 7  | 12 |  200 | 5.00 |
| 8  |  9 |  150 | 6.67 |
| 9  |  7 |  117 | 8.57 |
| 10 |  5 |   83 | 12.0 |
| 11 |  4 |   67 | 15.0 |
| 12 |  3 |   50 | 20.0 |
| 13 |  2 |   33 | 30.0 |
| 14 |  1 |   17 | 60.0 |
| 15+ | 1 |   17 | 60.0 |

**曲線特徵**：

- L1–L10 以近似幾何級數遞減（比率約 0.78），對應「標準 Tetris NES 曲線」的縮尺版
- L11–L14 線性收斂至 1 tick
- L15+ 平台化（1 tick 為下限，配合下方 §2.3 lockDelay 收緊營造「快但仍可控」）
- **實作**：`const GRAVITY_TABLE: readonly number[] = [60, 48, 37, 28, 21, 16, 12, 9, 7, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1];`（長度 20，索引 = `level - 1`；值域 `[1, 60]` ⊂ u8）

**FSM 整合**（引用 ADR-0001 §2.4.1）：

- `FALLING` 每 tick 累加 `gravityAcc += 1`；當 `gravityAcc >= GRAVITY_TABLE[level - 1]` 觸發下移一格並歸零
- `SPAWN` 時 `gravityAcc = 0`（新 piece 從零起算）
- 軟降時 `gravityAcc` 加速累加（見 §2.6）

### 2.3 Lock Delay 曲線

保留 ADR-0001 §2.4.2 的 **15 次 reset 上限**與其他規則，僅調 `lockDelay` 時長：

| level | lockDelay (ms) | 說明 |
|-------|----------------|------|
| 1–10  | 500 | 預設，與 ADR-0001 §2.4.2 一致 |
| 11    | 450 | 開始收緊 |
| 12    | 400 | |
| 13    | 350 | |
| 14    | 300 | |
| 15+   | 250 | 下限；配合 L15+ 1 tick 重力，仍保留 ~15 tick 反應窗 |

**實作**：`const LOCK_DELAY_TABLE_MS: readonly number[] = [500,500,500,500,500,500,500,500,500,500, 450,400,350,300, 250,250,250,250,250,250];`（值域 `[250, 500]` ⊂ u16）

**不變式**：

- 15-reset 上限**恆為 15**，不隨關卡改變；此為 ADR-0001 §2.4.2 定義的抗 stall 硬上限
- 「硬降忽略 lockDelay」語意不變
- 「脫離地面 reset 次數保留」語意不變

### 2.4 Bag 權重曲線

ADR-0001 §2.3 定義 7-bag 變體以「1-cell / 2-cell / 3-cell / 4-cell」四桶為權重。本 ADR 定義隨關卡調整的權重表：

| level | M1 (1-cell) | 2-cell | 3-cell | 4-cell | 合計 |
|-------|-------------|--------|--------|--------|------|
| 1–5   | 5  | 15 | 30 | 50 | 100 |
| 6–10  | 3  | 12 | 30 | 55 | 100 |
| 11–15 | 2  | 10 | 28 | 60 | 100 |
| 16–20 | 1  |  8 | 26 | 65 | 100 |

- 高關卡 4-cell 佔比上升 → piece 佔用格數與 kick 觸發率提升，配合 5×5×12 井道加大擁擠感
- 1-cell / 2-cell 佔比下降 → 減少「白給救場」piece
- **絕不歸零**：任一桶權重最低為 `1`（M1 於 L16+）；避免玩家長時間看不到某桶造成節奏偏斜

**桶內 typeId 分配**（延用 ADR-0002 §2.1）：

- **1-cell 桶**：M1
- **2-cell 桶**：D2
- **3-cell 桶**：I3, V3（桶內均勻抽）
- **4-cell 桶**：I4, O4, L4, T4, S4, RS4, LS4, BR4（桶內均勻抽）

**Bag 補充機制**（延用 ADR-0001 §2.3 的 7-bag 變體語意）：

1. 每輪 bag 抽 7 個 piece，依 bag 建立時 snapshot 的 `BAG_WEIGHTS[level - 1]` 桶權重加權
2. Bag 清空後重抽下一 bag（讀當時 `state.level` 對應的權重）
3. **關卡切換的雙軌生效時機**：
   - `state.level` 依 §2.1 於 `LOCKED → SPAWN` / `CLEARING → SPAWN` **立即**更新；重力表 §2.2 與 lock delay 表 §2.3 依新 level 立即切換
   - **Bag 權重延到 bag 邊界**：權重列於 bag 建立時 snapshot 並鎖定；本 bag 抽完後才重讀。避免同 bag 內權重跳變、以及跨 bag 邊界 piece 型別分佈失真

**實作**：`const BAG_WEIGHTS: readonly (readonly [number, number, number, number])[] = [ /* 20 rows, 見 §2.7 */ ];`（桶權重值域 `[1, 65]` ⊂ u8）

### 2.5 關卡分數倍率

ADR-0001 §2.7 步驟 6 基礎分表（`n = min(clearedLayers.length, 4)`）：

| n | 基礎分 |
|---|--------|
| 1 | 100 |
| 2 | 300 |
| 3 | 700 |
| 4 | 1500 |

**倍率規則**：

```
lineScore(n, level) = BASE_SCORE[n] × level
```

即 `finalScore = baseScore × level`（level ∈ [1, 20]，最大倍率 20 倍）。

**範例**：

- L1 清 4 層：1500 × 1 = **1500**
- L10 清 2 層：300 × 10 = **3000**
- L20 清 4 層：1500 × 20 = **30000**

**設計取捨**：

- **不採用 NES Tetris 的 `(level + 1)` 或指數倍率**：本作井深僅 12，一場遊戲進級不深；線性 × level 已在 20 倍上限產生足夠峰值
- **未含 combo / back-to-back / T-spin 加成**：ADR-0001 §5 明訂計分細節歸 ADR-0005；本 ADR 只定義「level × base」的最小可用倍率

### 2.6 軟降 / 硬降計分

補齊 ADR-0001 §2.7 步驟 6 未提及的下降類計分：

| 動作 | 每格分數 | 說明 |
|------|----------|------|
| 軟降 (`Down` 按住) | `1` | 玩家主動加速下墜；不受關卡倍率影響 |
| 硬降 (`Space`) | `2` | 一次結算，`rowsFallen × 2` 加至本 lock 的分數 |

**軟降行為**：

- 軟降時 `gravityAcc` 每 tick 加 `SOFT_DROP_GRAVITY_MULT = 20`（相當於 20 倍速）
- 每次成功下移一格記 `1` 分；若軟降速度已超過該關卡的自然重力，玩家仍可「按住加速」而不計分（防止 L14+ 已 1 tick/格時軟降無意義加分）
  - 實作：`if (gravityStep_current > 1) softDropScore += 1;`
- 上限：單一 piece 軟降累計 ≤ `12`（井深 12 為理論上限，防禦性封頂）

**硬降行為**：

- `Space` 按下後計算最終落點的下墜列數 `rowsFallen = origin_z - final_z`
- 加分：`hardDropScore = rowsFallen × 2`
- 立即進入 `LOCKED`（見 ADR-0001 §2.4.2）

**不受關卡倍率影響**：

- 軟降 / 硬降分數 = **玩家操作獎勵**，與關卡倍率脫鉤，避免高關卡靠猛按 `Space` 洗分
- 僅 `lineScore(n, level)` 乘 level

### 2.7 常數與載入

Polycube 表以 `POLYCUBE_DEFS` 於 ADR-0002 §2.6 定義；本 ADR 新增：

```ts
// src/engine/difficulty/tables.ts
export const MAX_LEVEL = 20 as const;
export const LAYERS_PER_LEVEL = 5 as const;

export const GRAVITY_TABLE: readonly number[] =
  [60, 48, 37, 28, 21, 16, 12, 9, 7, 5, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1];

export const LOCK_DELAY_TABLE_MS: readonly number[] =
  [500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
   450, 400, 350, 300, 250, 250, 250, 250, 250, 250];

export const BAG_WEIGHTS: readonly (readonly [number, number, number, number])[] = [
  // L1–L5
  [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50],
  // L6–L10
  [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55],
  // L11–L15
  [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60],
  // L16–L20
  [1,  8, 26, 65], [1,  8, 26, 65], [1,  8, 26, 65], [1,  8, 26, 65], [1,  8, 26, 65],
];

export const BASE_LINE_SCORE: readonly number[] = [0, 100, 300, 700, 1500];  // 索引 = n (0 未用)

export const SOFT_DROP_POINTS_PER_ROW = 1 as const;
export const HARD_DROP_POINTS_PER_ROW = 2 as const;
export const SOFT_DROP_GRAVITY_MULT = 20 as const;
```

**載入時 assert**（fail-fast，同 ADR-0002 §2.6 pattern）：

- `GRAVITY_TABLE.length === MAX_LEVEL`
- `LOCK_DELAY_TABLE_MS.length === MAX_LEVEL`
- `BAG_WEIGHTS.length === MAX_LEVEL`
- 對每 `w of BAG_WEIGHTS`：`w[0]+w[1]+w[2]+w[3] === 100` 且每元素 `>= 1`（絕不歸零）
- `GRAVITY_TABLE` 單調非增（`for i > 0: GRAVITY_TABLE[i] <= GRAVITY_TABLE[i-1]`）
- `LOCK_DELAY_TABLE_MS` 單調非增
- `BASE_LINE_SCORE[1..4]` 嚴格遞增（100 < 300 < 700 < 1500）

任一失敗立即 throw，避免以錯誤難度表運作。

## 3. 已考慮的替代方案 (Alternatives Considered)

- **每 10 層升一級（較平緩）**：一場遊戲僅升 3–5 級，L20 幾乎達不到。本作井道小、翻牌快，5 層 / 級節奏更合適
- **NES 指數重力公式** `(0.8 - (level-1)*0.007)^(level-1)` 秒/格：連續函數計算成本低，但無明確 tick 對齊；本作為 60Hz 固定 tick，直接查 `u8` 表更 cache-friendly 且行為可精確重現（重播必要）
- **20G / sub-tick gravity**：一 tick 內連續下移到底。井深僅 12，L20 一格一 tick 已足夠快；20G 破壞 lockDelay 語意，實作代價過高
- **升級用「分數」而非「層數」**：分數受 level × combo 放大 → 越升越快 → 反向失控。層數線性、中性
- **Bag 權重固定不變（不隨關卡）**：實作最簡但難度靠純速度撐；4-cell 增加提供另一維難度、且不需重寫 §2.3 FSM
- **軟降 / 硬降 × 關卡倍率**：會鼓勵高關卡「按 Space 洗分」；已否決
- **L1 起始 gravityStep = 30（0.5 sec/格）而非 60**：初玩者友善不足；60 tick = 1 sec/格 是主流 Tetris 慣例
- **Lock delay 隨關卡下降但保留 15 reset**：本 ADR 已採；替代為「reset 上限也降」會直接改 §2.4.2 不變式，超出本 ADR 範圍

## 4. 影響 (Consequences)

### 正面

- 難度曲線以純表定義，運行時查表 O(1)，無浮點運算
- 20 級曲線 + 5 層 / 級 = 100 層可達 L20，一場長局可完整展現
- Lock delay 與重力雙軸拉升 → 提供「快但不失控」的手感梯度
- Bag 權重曲線提供第三維難度來源（幾何複雜度），且不與速度共線
- 常數表 + assert → 修改需通過載入自檢，難度誤植不易漏

### 負面 / 風險

- 20 級是否對「短井道」過長，需 spike / playtest 驗證；可能收斂為 12–15 級
- L14+ 之 1 tick / 格 + 250 ms lockDelay 是否對人類可玩、未驗證；輸入延遲 + 60Hz tick 抖動下實測可能感覺無法反應
- Bag 權重曲線的實驗性強，需回頭以「玩家 layer clear rate / game duration」統計驗證
- 「軟降不計分於 L14+」的條件式規則可能讓玩家困惑；需 UI 提示或改為「無條件計分但個 piece 封頂」

### 未決 / 交由 spike 驗證

- L14+ 是否需再收緊 lockDelay（例如降至 200 ms）
- 4-cell 桶內是否需再對 BR4 / RS4 / LS4 給更低權重（實體積過大、5×5 井道旋轉困難）— 目前桶內均勻抽
- 軟降 / 硬降加分是否過低（無法在高分區間顯現）— spike 期收集分數分佈後回頭調
- 是否於 UI 顯示「當前重力」/「距下級剩餘層數」等副資訊

## 5. 後續行動 (Follow-ups)

- 實作 `src/engine/difficulty/tables.ts`：本 ADR §2.7 定義的全部常數 + 載入 assert
- 實作 `src/engine/difficulty/level.ts`：升級判定、`gravityStep` / `lockDelay` 查詢介面
- 修改 `src/engine/core/fsm.ts`（配合實作階段）：`FALLING` 讀 `gravityStep`；`GROUNDED` 讀 `lockDelay`；`CLEARING` 結算 `lineScore(n, level)` 並依 `totalLayersCleared` 觸發升級
- 修改 `src/engine/rng/bag.ts`：讀 `BAG_WEIGHTS[level-1]`，於 bag 邊界重載
- 單元測試涵蓋：
  - `nextLevel` 於各 `totalLayersCleared` 邊界（0, 4, 5, 99, 100, ...）
  - `lineScore(n, level)` 於所有 `(n, level)` 組合
  - Bag 權重總和 = 100 且無 0
  - `GRAVITY_TABLE` / `LOCK_DELAY_TABLE_MS` 單調性
- Spike 期收集玩家 game duration / max level reached / score 分佈，於 ADR-0003 rev.2 定案
- 依 LA4 verdict，本 ADR 若通過正確性 review，正式合入
- ADR-0005（計分細節：combo / T-spin 類 / back-to-back）將以此 §2.5 為基座擴充；本 ADR 明確**不涵蓋** combo 與 T-spin

## 6. 修訂紀錄 (Revision History)

### rev.2 — 2026-07-22 · LA4 round-1 review PASS (0 blocking)；修 2 Should + 2 Nit + status → Accepted

- **S1**：§2.4 bag 補充機制原稱「（既有 anti-repeat 規則）」為誤植 — ADR-0001 §2.3 與 ADR-0002 §2.7 均無此條文，該段已改寫為「bag 建立時 snapshot 權重」的正確語意，anti-repeat 規則另議（可歸 ADR-0005 或 ADR-0001 rev.5）
- **S2**：§2.1（level 立即更新）vs §2.4 pt3（bag 邊界才換）之時機歧義；§2.4 pt3 已明寫「level / gravity / lockDelay 立即 · bag 權重延到 bag 邊界」的雙軌生效
- **N1**：§2.7 assert 「嚴格遞增（1500 > 700 > 300 > 100）」括號方向反了 → `(100 < 300 < 700 < 1500)`
- **N2**：§2.2 / §2.3 / §2.4 內嵌 TS snippet 用 `u8` / `u16` 非合法 TS 原生型別；統一為 `number` 並在括號註明值域（`⊂ u8` / `⊂ u16`），與 §2.7 code block 一致
- LA4 review 記錄：`brain get oab/adr/0003-review-round1`

### rev.1 — 2026-07-22

初稿。依 ADR-0001 rev.4 §5 對「難度曲線 / 重力表 / bag 權重」的授權，並補齊 §2.7 步驟 6 引用之關卡倍率與 §2.4.2 lockDelay 未定的曲線。
