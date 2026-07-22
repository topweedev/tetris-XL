---
title: ADR-0005 Hold, Combo, Spin, Back-to-Back and Extended Score Formula
type: decision
status: accepted
adr_id: "0005"
repo: topweedev/tetris-XL
path: docs/adr/0005-hold-combo-spin-b2b-scoring.md
tags: [adr, tetris-xl, scoring, hold, combo, spin, back-to-back, b2b]
---

# ADR-0005: Hold、連擊 (Combo)、Spin、Back-to-Back 與擴充計分公式

- 狀態：Accepted
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：ADR-0001（rev.4）§2.1 / §2.4.1 / §2.4.3 / §2.7、ADR-0002（rev.3）§2.4 / §2.5、ADR-0003（rev.2）§2.5 / §2.6、ADR-0004（rev.2）§2.2 / §2.3 / §2.4

## 1. 背景 (Context)

ADR-0001 rev.4 §5 明訂 ADR-0005 之範圍：

> ADR-0005：計分細節（連擊、T-spin 類 3D 變體、關卡倍率公式）

ADR-0003 rev.2 §5 補充：

> ADR-0005（計分細節：combo / T-spin 類 / back-to-back）將以此 §2.5 為基座擴充

ADR-0004 rev.2 §5 追加 punt：

> Hold 於 MVP 未實作；隨 ADR-0005 落地時另指定 key（試探 `Tab` 或 `C`）

本 ADR 補齊：

- **Hold 機制**：piece swap 語意、anti-abuse、鍵位鎖定
- **連擊 (Combo)**：定義、計數、bonus 公式
- **Spin (T-spin 類 3D 變體)**：3D 通用化的偵測條件與 bonus
- **Back-to-Back (B2B)**：special clear 連續獎勵
- **擴充 lineScore 公式**：整合 spin × b2b × level，保證整數運算無精度流失
- **Score 事件（UI 邊界）**：於 ADR-0001 §2.1 event bus 上新增 UI 通知事件

## 2. 決策 (Decision)

### 2.1 Hold 機制

**功能語意**：玩家可暫存當前 piece 於 hold slot；下次呼叫可與 slot 內 piece 交換或首次存入。

**狀態欄位**（於 `GameState`）：

```ts
holdSlot: TypeId | null;         // 存放的 piece typeId；初始 null
holdUsedThisPiece: boolean;      // 本 piece 生命期是否已用過 hold；初始 false
```

**觸發流程**（`GameAction.Hold` 於 §2.3 之 FSM 內處理）：

```
onHold():
  if holdUsedThisPiece: return no-op（anti-abuse，見下）
  if state != FALLING and state != GROUNDED: return no-op（僅可玩期間允許）
  
  const currentTypeId = state.piece.typeId
  const swapTypeId    = state.holdSlot     // 可能 null
  
  state.holdSlot           = currentTypeId
  state.holdUsedThisPiece  = true
  
  if swapTypeId === null:
    spawnFromBag()         // 從 §2.7 bag 抽下一個
  else:
    spawnFromTypeId(swapTypeId)   // 直接以 swapTypeId 生成
  
  # spawn 走 ADR-0001 §2.4.4 之預設位置 (2, 2, 11)
  # 用 ADR-0002 §2.5 spawn-kick 表（MVP 為空表；碰撞即 game over per ADR-0001 §2.4.3）
```

**anti-abuse `holdUsedThisPiece` flag**：

- 每 piece 只能 hold 一次；避免玩家反覆 hold 洗掉不利 piece 又立即換回
- 於 `SPAWN` state 進入時重置為 `false`（無論此 piece 來自 hold slot swap-back，或首次 hold 時 slot 空之從 bag 抽取路徑）
- 於 `GAME_OVER → BOOT` 重置 `holdSlot = null`、`holdUsedThisPiece = false`

**與 ADR-0001 §2.4.1 FSM 之整合**：

- Hold action 只於 `FALLING` / `GROUNDED` 消化；其他 state 忽略
- Hold 後的 spawn 走**新** piece 的 `SPAWN` state（不跳過 spawn-check 與 top-out 判定）
- 消耗 Hold 於 `GROUNDED` 期間會生成新 piece，新 piece 進入自己的 grounded 生命期時，`lockDelay` 計時器與 §2.4.2 之 15-reset cap 皆為新 piece 之獨立實例，自然歸零（等同於一般 lock-then-spawn 之計時器重置語意）

**與 ADR-0004 §2.3 tick 順序之整合**：

Hold 於 tick 內處理順序：`Pause → Restart → Rotation → Translation → SoftDrop → HardDrop → Hold`。同 tick 若同時有 HardDrop + Hold，HardDrop 先觸發 → 立即 LOCKED → 之後 Hold 於 GROUNDED/LOCKED 之外 → no-op。此順序防止「同 tick hard-drop 完又 hold 走 piece」的 abuse。

**鍵位鎖定**：

- **`C`** → `GameAction.Hold = 40`（值於 ADR-0004 §2.2 已保留）
- 選 `C` 而非 `Tab`：`Tab` 有瀏覽器焦點切換副作用（`preventDefault` 需 focus 於 canvas；不穩定），`C` 為單純字母鍵、無 modifier 語意、於 QWEASD 旋轉區之外
- 此為 ADR-0004 §2.4 spike keymap 之**擴充**（新增一列 `C → Hold`）；不改動其他 12 個既定 binding

### 2.2 連擊 (Combo)

**定義**：連續 N 個 piece 於 lock 時 clear ≥ 1 layer，稱為 N 連擊。任一 piece 於 lock 時 `clearedLayers === 0` 即中斷。

**Hold 與 combo 的關係**：Hold action 本身**不觸發 lock**（見 §2.1 `onHold()`，僅 swap slot 與生成新 piece），因此 hold-swap 不改變 combo 狀態；swap 換入的替換 piece 隨其 lock 結果（有無 clear）正常參與 combo 計數，與從 bag 抽出之新 piece 無異。

**狀態欄位**：

```ts
combo: number;   // 初始 -1；range 為 [-1, ∞)（會於 §2.7 bonus 查表時 clamp）
```

**觸發**（於 §2.5 lineScore 計算之前）：

```
onPieceLock(clearedLayers):
  if clearedLayers.length > 0:
    state.combo += 1
    if state.combo > 0:
      bus.emit('comboIncremented', { count: state.combo })
  else:
    if state.combo >= 0:
      # previousCount = 中斷前之連續 clear 數 = state.combo + 1（因 combo 由 -1 起算）
      bus.emit('comboReset', { previousCount: state.combo + 1 })
    state.combo = -1
```

**注意**：`combo` 從 `-1` 起算而非 `0`，使得「首次 clear」對應 `combo = 0`、bonus 為 0；「連續第 2 次 clear」對應 `combo = 1`、bonus 非零。這是模仿 Modern Tetris SRS combo 語意，簡化 bonus 表為單一乘積：

```
comboBonus(combo, level) = combo > 0 ? 50 × min(combo, MAX_COMBO_CAP) × level : 0
```

- `MAX_COMBO_CAP = 10`：combo ≥ 10 皆以 10 計 bonus（防禦性封頂）
- Bonus 於 lock 分數之外**加總**（不乘 spin / b2b 倍率）
- 於 `GAME_OVER → BOOT` 重置 `combo = -1`

**範例**：

| 連續 clear 序列 | combo 值序列 | bonus per lock (L=5)  |
|-----------------|--------------|----------------------|
| clear, clear, clear | 0, 1, 2 | 0, 250, 500 |
| clear, clear (no-clear), clear | 0, 1, (-1), 0 | 0, 250, (0), 0 |

### 2.3 Spin (3D T-spin 類變體)

**問題**：經典 T-spin 為 2D T-piece 特化偵測（4 個角落佔用檢查）。3D 12 種 polycube 集合下無單一 piece 型別對應 T；需通用化。

**決策**：**通用 Spin 偵測 (Kick-Rotation Lock)**：

- 若 piece 於此次 lock 之前**最後一個成功動作為旋轉 (§2.2 `RotateYaw*` / `RotatePitch*` / `RotateRoll*` / `Flip`) 且該旋轉消耗了非 (0,0,0) 之 kick offset**（ADR-0002 §2.4 kick 流程步驟 2b），則此 lock 為 **Spin lock**。
- 判定於 lock 前一 tick 快照 `state.lastRotationUsedKick: boolean`；translation / drop / no-op tick 皆 reset 此 flag 為 false。

```
onRotationSuccess(kickOffset: [number, number, number]):
  state.lastRotationUsedKick = (kickOffset != [0,0,0])
  state.lastActionWasRotation = true

onTranslationOrDrop():
  state.lastActionWasRotation = false
  state.lastRotationUsedKick  = false

onPieceLock():
  const isSpin = state.lastActionWasRotation && state.lastRotationUsedKick
  # ↑ 於 lock 分數計算使用
```

**設計取捨**：

- **簡潔勝於精準**：本判定不區分 piece 型別（例：BR4 tripod kick lock 也算 spin）；於 3D 5×5 井道與 14-offset kick 表（ADR-0002 §2.4）之組合下，kick-rotation lock 本身已需玩家有意識規劃，無 abuse 空間
- **只 look-back 1 動作**：不追蹤更早的動作歷史；避免 state bloat
- **不限特定 piece**：避免與 ADR-0002 §2.1 未來擴充 (pentacube) 之相容性負擔

**Spin bonus 兩情境**：

1. **Spin + 有 clear (`clearedLayers > 0`)**：走 §2.5 `lineScore(n, level, isSpin=true, isB2B)`，本 lock 得 spin × level × (b2b 若啟用) 倍率
2. **Spin + 無 clear (`clearedLayers === 0`)**：加分 `SPIN_NO_CLEAR_BASE × level`（`= 25 × level`，L1=25 至 L20=500），為玩家風格獎勵；**不**觸發 combo 遞增、**不**觸發 B2B 遞進

**事件**：

- Lock 時若判定 spin：`bus.emit('spinDetected', { withClear: clearedLayers > 0, score: clearedLayers > 0 ? 0 : SPIN_NO_CLEAR_BASE * state.level })`
  - `withClear=true` 時 `score=0`（實際 clear 分數由 `linesClear` 事件之 `score` 欄位承載，避免雙重計數）
  - `withClear=false` 時 `score = 25 × level`（即 spin-no-clear bonus），使 UI 可即時顯示「純 spin 得分」浮動數字

### 2.4 Back-to-Back (B2B)

**定義**：連續兩次或多次「special clear」不被「normal clear」中斷，即 back-to-back 狀態。

**Special clear** = `clearedLayers > 0 AND (clearedLayers.length === 4 OR isSpin === true)`：

- 4-layer 清（"quad"）為 special
- Spin-with-clear 為 special（任意 n）
- 兩者交錯亦計 B2B

**Normal clear** = `clearedLayers > 0 AND !(clearedLayers.length === 4 OR isSpin === true)`：

- 1/2/3-layer 清且無 spin 者為 normal

**No clear** = `clearedLayers === 0`：既非 special 亦非 normal；**不影響** B2B 狀態（保留）

**狀態欄位**：

```ts
b2bActive: boolean;  // 初始 false
b2bCount:  number;   // 初始 0；當前連續 special clear 之次數；僅供 §2.6 UI 事件 payload，不參與 §2.5 分數計算
```

**觸發流程**（於 §2.2 combo 觸發之後）：

```
onPieceLock(clearedLayers, isSpin):
  const isSpecial = clearedLayers.length > 0 && (clearedLayers.length === 4 || isSpin)
  const isNormal  = clearedLayers.length > 0 && !isSpecial
  
  const wasActive = state.b2bActive              # 快照舊值，決定 applyB2B / emit 語意
  const applyB2B  = isSpecial && wasActive       # 本 lock 是否得 b2b 加成
  
  if isSpecial:
    state.b2bActive = true
    state.b2bCount  = wasActive ? state.b2bCount + 1 : 1
    if wasActive: bus.emit('b2bContinued', { count: state.b2bCount })
    else:         bus.emit('b2bStart')
  elif isNormal:
    if wasActive: bus.emit('b2bBroken', { count: state.b2bCount })
    state.b2bActive = false
    state.b2bCount  = 0
  # no clear：不動
  
  # applyB2B 用於 §2.5 lineScore
```

**注意**：

- `b2bCount` 僅為 UI 顯示計數，不參與分數計算（分數只用 `applyB2B: boolean`）
- 首個 special clear 建立 B2B 狀態但**該 clear 本身不得 B2B 倍率**（`applyB2B = state.b2bActive` 於改變 `b2bActive` 之前判定）；「back-to-back」語意即從第二個開始才連續
- 於 `GAME_OVER → BOOT` 重置 `b2bActive = false`、`b2bCount = 0`

### 2.5 擴充 lineScore 公式

**基座** (ADR-0003 §2.5)：

```
BASE_SCORE = [_, 100, 300, 700, 1500]   # 索引 = n = min(clearedLayers.length, 4)
lineScore(n, level) = BASE_SCORE[n] × level
```

**擴充**：

```
lineScore(n, level, isSpin, isB2B) =
  BASE_SCORE[n] × SPIN_MULT_NUM × B2B_MULT_NUM × level / B2B_MULT_DEN
```

**其中**：

| 條件 | `SPIN_MULT_NUM` | `B2B_MULT_NUM` | `B2B_MULT_DEN` |
|------|------------------|----------------|----------------|
| 一般 clear (無 spin，無 b2b) | 1 | 1 | 1 |
| Spin clear，無 b2b | 4 | 1 | 1 |
| 一般 clear，b2b active | 1 | 3 | 2 |
| Spin clear，b2b active | 4 | 3 | 2 |

`SPIN_MULT_DEN` 恆為 `1`（略）；`B2B_MULT_DEN` 為 `2` 之情況下需保證整數運算無 truncation。

**整數運算保證**：

- 所有 `BASE_SCORE[n] ∈ {100, 300, 700, 1500}` 皆為 4 的倍數
- 因此 `BASE_SCORE[n] × SPIN_MULT_NUM × B2B_MULT_NUM × level` 恆為 `2` 之倍數
- 除以 `B2B_MULT_DEN ∈ {1, 2}` 結果恆為整數
- 於 JS/TS `number` (float64) 範圍內：最大值 `1500 × 4 × 3 × 20 / 2 = 180000` << `Number.MAX_SAFE_INTEGER (2^53 - 1)`，無精度流失
- 載入時 assert `BASE_SCORE.every(s => s % 4 === 0)` 保證上述性質恆真

**完整 finalScore**（於 §2.7 步驟 6 之計分擴充）：

```
finalScore(n, level, isSpin, isB2B, combo, softRows, hardRows) =
  lineScore(n, level, isSpin, isB2B)
  + comboBonus(combo, level)                    # §2.2
  + (isSpin && n === 0 ? SPIN_NO_CLEAR_BASE × level : 0)   # §2.3 spin without clear
  + softRows × SOFT_DROP_POINTS_PER_ROW          # ADR-0003 §2.6
  + hardRows × HARD_DROP_POINTS_PER_ROW          # ADR-0003 §2.6
```

**校驗範例**：

| 情境 | Level | n | isSpin | isB2B | combo | 計算 | 結果 |
|------|-------|---|--------|-------|-------|------|------|
| L1 首次單消 | 1 | 1 | F | F | -1 | 100×1×1×1/1 | **100** |
| L1 首次 quad | 1 | 4 | F | F | -1 | 1500×1×1×1/1 | **1500** |
| L5 spin double | 5 | 2 | T | F | -1 | 300×4×1×5/1 | **6000** |
| L10 quad + b2b | 10 | 4 | F | T | -1 | 1500×1×3×10/2 | **22500** |
| L10 spin quad + b2b | 10 | 4 | T | T | -1 | 1500×4×3×10/2 | **90000** |
| L20 spin quad + b2b + combo 3 | 20 | 4 | T | T | 3 | 1500×4×3×20/2 + 50×3×20 | **180000 + 3000 = 183000** |
| L1 spin 無 clear | 1 | 0 | T | – | -1 | 0（lineScore=0，因 n=0 走 BASE[0]=0）+ 25×1 | **25** |

### 2.6 Score 事件（UI 邊界）

補 ADR-0001 §2.1 之 event bus 事件清單：

| 事件 | payload | 觸發時機 |
|------|---------|----------|
| `linesClear` | `{ n, isSpin, isB2B, score, combo }` | 每次 lock 有 clear |
| `spinDetected` | `{ withClear: boolean, score: number }` | Lock 判定為 spin；`withClear=false` 時 `score = SPIN_NO_CLEAR_BASE × level`（UI 顯示純 spin 得分），`withClear=true` 時 `score=0`（實分走 `linesClear.score`） |
| `comboIncremented` | `{ count: number }` | combo ≥ 1 |
| `comboReset` | `{ previousCount: number }` | combo 由 ≥ 0 中斷為 -1；`previousCount` = 中斷前之連續 clear 數 = 舊 `combo + 1` |
| `b2bStart` | `{}` | 第一次 special clear（`b2bActive: false → true`） |
| `b2bContinued` | `{ count: number }` | 連續 special clear（applyB2B = true） |
| `b2bBroken` | `{ count: number }` | b2b 被 normal clear 打斷；`count` 為中斷前之 `b2bCount` |
| `holdSwapped` | `{ storedTypeId, swappedInTypeId }` | Hold action 執行成功 |

**遵循 ADR-0001 §2.1**：「事件匯流排僅用於 UI 邊界」；tick path 純函式不依賴 bus。

### 2.7 常數與載入 assert

```ts
// src/engine/scoring/tables.ts
export const MAX_COMBO_CAP = 10 as const;
export const COMBO_POINTS_PER_STEP = 50 as const;

export const SPIN_MULT_NUM = 4 as const;
export const SPIN_MULT_DEN = 1 as const;

export const B2B_MULT_NUM = 3 as const;
export const B2B_MULT_DEN = 2 as const;

export const SPIN_NO_CLEAR_BASE = 25 as const;

// src/engine/input/keymap.ts（新增列，延用 ADR-0004 §2.4 之其他 12 列）
export const HOLD_KEY_CODE = "KeyC" as const;
```

**載入時 assert**（fail-fast，同 ADR-0002 §2.6 / ADR-0003 §2.7 pattern）：

- `MAX_COMBO_CAP` 為正整數
- `COMBO_POINTS_PER_STEP` 為正整數
- `SPIN_MULT_NUM / SPIN_MULT_DEN` 為正整數比（`DEN | NUM`：`1 | 4` ✓）
- `B2B_MULT_NUM / B2B_MULT_DEN` 使 `BASE_SCORE[n] × B2B_MULT_NUM × level` 恆能整除 `B2B_MULT_DEN`：
  - 由於 `BASE_SCORE[n] % 4 === 0`（load 時另 assert），且 `B2B_MULT_DEN = 2`，`4 % 2 === 0` 恆成立
- `SPIN_NO_CLEAR_BASE` 為非負整數
- `HOLD_KEY_CODE === 'KeyC'` 且**未於 ADR-0004 §2.4 其他 12 列出現**（load-time cross-check spike keymap 表無衝突）

## 3. 已考慮的替代方案 (Alternatives Considered)

- **Hold 無 anti-abuse flag（允許無限 hold）**：玩家可 hold → 檢查新 piece → 若不佳再 hold → 循環直到得到合意 piece → 破壞 bag 隨機性設計（ADR-0003 §2.4）。已否決；`holdUsedThisPiece` flag 為必須
- **Hold 鍵綁 `Tab`**：`Tab` 於瀏覽器有 focus-navigation 副作用；需 `preventDefault` 且要求 canvas 有 focus，UX 較不穩定。改用 `C`
- **經典 T-spin 偵測（4 corners）**：3D 12 種 polycube 集合下，特定 piece 之「corners 檢測」需為每個 typeId 定義 corner 集合，維護成本高且與未來 pentacube 擴充相斥。改用通用「kick-rotation lock」偵測
- **Spin 需 look-back N 動作**：狀態 bloat；1-動作 look-back 已足以識別「玩家有意規劃之旋轉入位」，無 abuse 空間（kick 表僅 14 offset，非平凡命中率有限）
- **Combo 從 0 起算（首次 clear 即 combo=1）**：使首次 clear 得 combo bonus，與「連擊」語意違和；改為 `-1` 起算，第 2 個 clear 起才有 bonus，符合 modern Tetris SRS 慣例
- **B2B 使用固定 1.5× 浮點乘**：於 JS `number` 為 float64，`1500 × 1.5 = 2250` 精確，但 float 於未來擴充（例如 1.33×）易累積誤差。改用 `NUM/DEN` 有理數形式 + load 時 assert 整除性，未來擴充只需維持 `BASE_SCORE[n] % NEW_DEN === 0`
- **Spin bonus 隨 piece 型別加權**（例：BR4 spin 更難、給更高倍）：正確性難驗證；MVP 一律 4× 倍率
- **Combo bonus 為指數表**（如 combo^1.5 × 50）：與整數運算保證衝突；線性 `50 × combo × level` 已提供足夠激勵
- **Hold slot 保留旋轉狀態**：即 hold 時記錄 piece 的 `rotationStateId`，swap 回來時保留旋轉。已否決；hold 交換後應以**新 piece 之預設旋轉態**生成，模擬「另一顆 piece 從天而降」，語意清楚且不繞過 spawn top-out 檢查

## 4. 影響 (Consequences)

### 正面

- Hold 機制提供標準 Tetris 之核心操作維度；anti-abuse flag 保證公平性
- 通用 Spin 偵測避免與 piece 型別耦合，向 pentacube 擴充相容
- Combo / B2B 為玩家提供風格獎勵，深化熟練玩家的分數上限
- 全部 bonus 皆整數運算，替 replay 決定論、跨平台一致性提供保證
- Score 事件走 ADR-0001 §2.1 event bus，符合 UI 邊界設計

### 負面 / 風險

- Spin 偵測基於「最後動作 = kick-rotation」，於某些 rotation-locked-in-place（例：BR4 於 5×5 井道無法離開特定角落）可能誤觸；需 spike 期收集 spin 觸發頻率驗證
- B2B 之 4-layer clear 於 5×5×12 井道罕見（需 4-cell I 型豎直清 4 列，機率低），spike 期若統計 B2B 觸發率 < 1%，需考慮 B2B 條件寬鬆化（例：3-layer + spin 亦算 special）
- Hold key `C` 於 QWEASD 旋轉區旁，可能誤觸；spike 期若統計 hold 誤按率高，改綁 `Tab`（需先解 `preventDefault` 問題）
- 擴充公式引入 `isSpin` / `isB2B` / `combo` 三個新輸入，實作時容易漏傳；建議以 `LockContext` interface 集中傳遞
- 4 種倍率組合（1x / 4x / 1.5x / 6x）於高關卡差距懸殊（L20 spin quad b2b = 90000，L20 spinless single = 2000），可能造成「一 lock 定勝負」現象；spike 期需 playtest 驗證

### 未決 / 交由 spike 驗證

- `MAX_COMBO_CAP = 10` 之封頂值：實測 combo ≥ 10 之發生頻率若接近 0，可保持；若常見則調高
- `SPIN_MULT = 4`、`B2B_MULT = 1.5` 之具體數值：可能需依 playtest 分數分佈調整
- Hold 是否要於 UI 顯示 hold slot 之 piece 預覽（強烈建議實作，但屬 UI 細節 → ADR-0007）
- Spin bonus 是否要於 `clearedLayers === 0` 情境下也計入 combo（目前不計）
- B2B 是否要有 count 上限之封頂 bonus 表（目前為 boolean，於未來 rev.2 可擴充為表）

## 5. 後續行動 (Follow-ups)

- 實作 `src/engine/scoring/`：
  - `tables.ts`：本 ADR §2.7 之全部常數 + assert
  - `combo.ts`：§2.2 combo 狀態機
  - `spin.ts`：§2.3 spin 偵測（look-back 1）
  - `b2b.ts`：§2.4 B2B 狀態機
  - `formula.ts`：§2.5 `lineScore` / `finalScore` 純函式
  - `hold.ts`：§2.1 hold slot 狀態與 swap 邏輯
- 修改 `src/engine/core/fsm.ts`（配合實作階段）：於 `LOCKED → CLEARING/SPAWN` 呼叫 §2.5 finalScore；於 `FALLING/GROUNDED` 期消化 `GameAction.Hold`
- 修改 `src/engine/input/mapper.ts`（ADR-0004 §2.4 spike keymap）：新增 `KeyC → Hold` 一列
- 修改 `src/engine/events/bus.ts`：登記 §2.6 之 8 個新事件
- 修改 `src/engine/types/input.ts`：`GameAction.Hold = 40` 已於 ADR-0004 保留，無需改
- 修改 `src/engine/rng/replay.ts`：replay stream 之 GameAction 已含 Hold；無需 schema 變更；但 replay 播放需支援 hold slot 狀態重建
- 單元測試：
  - Hold anti-abuse: 連續兩次 Hold 於同 piece 生命期 → 第二次 no-op
  - Hold + top-out: hold-swap 後 spawn 失敗 → §2.4.3 game over
  - Combo 邊界: combo 從 -1 → 0 → 1 → ... 之增量正確；no-clear 重置為 -1
  - Spin 偵測: kick-rotation followed by lock → spin=true；translation-then-lock → spin=false
  - B2B 邊界: quad → spin-single → spin-triple 皆為 special；三連得 B2B x2；一 single 打斷後歸 0
  - lineScore 表：本 ADR §2.5 之 7 個校驗範例全通過
  - Integer 運算: 所有 `finalScore` 結果為整數（`Number.isInteger` 檢查）
- **ADR-0001 rev.5 delta（隨本 ADR 落地）**：§2.6 之 `Shift` 從「保留 (hold)」正式改為 `SoftDrop`（per ADR-0004 §5）；hold 已於本 ADR 綁定 `C`。**該 rev.5 建議與本 ADR 同 PR 或 立即隨後之獨立 PR 進行**
- **ADR-0003 rev.3 delta**：§2.6 表格 `(Down 按住)` 已於 ADR-0004 §5 標為佔位語意；建議與 ADR-0001 rev.5 同 PR 一併補註
- Spike 執行時收集 hold 觸發率、spin 觸發率、B2B 連續長度分佈 → ADR-0005 rev.2 微調常數
- 依 LA4 verdict，本 ADR 若通過正確性 review，正式合入
- **ADR-0006（條件觸發）** 之持久化 / replay 格式擴充，可基於本 ADR §2.6 事件清單設計 UI 重播疊層

## 6. 修訂紀錄 (Revision History)

### rev.2 — 2026-07-22

依 LA4 round-1 correctness review 修訂（brain：`oab/adr/0005-review-round1`；verdict：PASS，0 Blocking / 3 Should / 5 Nit）：

- **S1 → §2.2 combo 定義**：移除誤導性括號「不含 hold-swap 前置的取代 piece」；改寫明訂 Hold action 本身不觸發 lock，因此不影響 combo；swap 後之替換 piece 依常規正常參與 combo 計數。
- **S2 → §2.3 事件 + §2.6 事件表**：`spinDetected` payload 新增 `score: number` 欄位。`withClear=false` 時 `score = SPIN_NO_CLEAR_BASE × level`（使 UI 收得到純 spin 得分）；`withClear=true` 時 `score=0`，避免與 `linesClear.score` 雙重計數。
- **S3 → §2.4 狀態欄位**：`b2bCount: number`（初始 `0`）補入宣告；標明僅供 §2.6 UI 事件 payload，不參與 §2.5 分數計算。
- **N1 → §2.1 Hold FSM 整合**：改寫 lockDelay 段落，移除誤導性「不受 15-reset cap 影響」；改為明確說明 Hold spawn 新 piece 進入獨立 grounded 生命期，計時器與 cap 為新實例自然歸零。
- **N2 → §2.4 pseudocode**：以 `wasActive` 快照舊 `b2bActive`，修掉 `state.b2bCount = (state.b2bActive ? state.b2bCount + 1 : 1)` 的 dead branch；同時把 `b2bContinued` emit 改為在 `state.b2bCount` 更新後發出（payload count 直接反映最新值）；`applyB2B` 亦改用 `wasActive` 語意更清楚。
- **N3 → §2.2 code + §2.6 表**：`comboReset` payload 由 `previous` 改名為 `previousCount`；附註「= 中斷前之連續 clear 數 = 舊 `combo + 1`」，同步更新 §2.6 表。
- **N4 → §2.1 anti-abuse flag 說明**：移除未定義之「hold-fill」術語；改寫成「無論此 piece 來自 hold slot swap-back，或首次 hold 時 slot 空之從 bag 抽取路徑」。
- **N5 → §2.1 spawn pseudocode 註解**：「§2.5 spawn-kick 表」跨參照補齊為「ADR-0002 §2.5 spawn-kick 表」；同段之 game-over 條件補齊為「per ADR-0001 §2.4.3」。

**Spin 偵測（kick-rotation lock vs 原 DISPATCH 期待之 immobility+三面接觸）**：LA4 認可本 ADR 採用之 kick-rotation lock 版本，理由已於 §2.3 設計取捨中說明；本輪不改。

**status**：Proposed → Accepted（LA4 verdict PASS + 全部 Should/Nit 已於本 rev.2 落實；待人類 approve 後 squash-merge）。

### rev.1 — 2026-07-22

初稿。依 ADR-0001 rev.4 §5、ADR-0003 rev.2 §5、ADR-0004 rev.2 §5 授權，補齊：

- Hold 機制（含 anti-abuse `holdUsedThisPiece` flag、鍵位鎖定為 `C`）
- Combo 計數與線性 bonus 公式（`50 × combo × level`，cap 10）
- 3D 通用 Spin 偵測（kick-rotation lock，1-動作 look-back）
- Back-to-Back（quad 或 spin-with-clear 為 special；normal clear 打斷）
- 擴充 lineScore 公式（`BASE × SPIN_NUM × B2B_NUM × level / B2B_DEN`，整數運算保證）
- Score UI 事件 8 個
- 常數表 + load-time asserts
