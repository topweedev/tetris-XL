---
title: ADR-0004 3D Input UX, Keymap, GameAction and Replay Determinism
type: decision
status: accepted
adr_id: "0004"
repo: topweedev/tetris-XL
path: docs/adr/0004-input-ux-and-keymap.md
tags: [adr, tetris-xl, input, keymap, ux, gameaction, replay, gamepad, touch]
---

# ADR-0004: 3D 輸入 UX、鍵位、GameAction 抽象與 Replay 決定論

- 狀態：Accepted
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：ADR-0001（rev.4）§2.4 / §2.4.1 / §2.4.2 / §2.6、ADR-0002（rev.3）§2.4 / §2.5、ADR-0003（rev.2）§2.6

## 1. 背景 (Context)

ADR-0001 rev.4 §2.6 定義了輸入 skeleton：

- 鍵盤主控：方向鍵 X/Y 平移、`Q/E/W/S/A/D` 對應三軸旋轉、`Space` 硬降、`Shift` 保留 (hold)
- 支援 gamepad（Web Gamepad API），行動裝置以觸控疊層按鈕
- 所有輸入透過中央 `InputMapper` 標準化為抽象 `GameAction`，方便重綁與重播

並於 §5 明訂 ADR-0004 之範圍與限制：

> spike 期先試「兩軸旋轉 + 一鍵翻轉」，**勿過早鎖 6 鍵映射**

同時，本 ADR 需解兩個既存的隱式衝突：

- **C1 · 軟降鍵未定**：ADR-0001 §2.6 未指派軟降鍵；ADR-0003 §2.6 以「(`Down` 按住)」為 label，若真綁 ↓ 會與 §2.6「方向鍵 X/Y 平移」的 Y-軸控制衝突（5×5 井道需要 ±X ±Y 四方位平移，4 個方向鍵已滿載）
- **C2 · Shift 語意重疊**：ADR-0001 §2.6 稱 Shift「保留 (hold)」；hold 於 MVP 未實作。若軟降暫用 Shift，等 hold 落地時需重新分配

本 ADR 補齊：

- 旋轉軸的參照系（世界座標 vs 螢幕座標）
- Spike 期鎖定的鍵位（僅 2 軸旋轉 + 1 翻轉，符合 §5 授權）
- Post-spike 完整 6 鍵映射的**原則**（不鎖具體鍵，留待 playtest）
- `GameAction` 抽象 enum 與其在 tick 內的處理順序（replay 決定論）
- Gamepad 對映 skeleton
- 觸控輸入的高階原則
- 重綁與 replay 之互動

## 2. 決策 (Decision)

### 2.1 旋轉軸參照系 (Rotation Frame)

**決策**：旋轉軸以 **世界座標系 (world frame)** 定義，key 對應 world axis：

- **Yaw** = 繞世界 `+Z` 旋轉（垂直軸）— 玩家俯瞰時「原地轉方向」
- **Pitch** = 繞世界 `+X` 旋轉（水平左右軸）— 「向前/向後翻」
- **Roll** = 繞世界 `+Y` 旋轉（水平前後軸）— 「側翻」

**理由**：

- 世界 frame 定義後，key → axis 對映不隨 ADR-0001 §2.5 相機切換（20° pitch vs 純垂直俯視）而改變；避免玩家在切相機時需要重新學習控制
- 旋轉表 (ADR-0002 §2.3) 展開時已於世界 frame 定義，直接查表即可，不需 runtime frame 轉換
- Replay 錄下的 `GameAction` 於任何相機模式下重放產生相同 piece state（決定論）

**代價**：玩家於 20° 傾斜視角下，roll (繞世界 +Y) 的視覺意義較不直觀（軸略朝深度方向傾斜 20°）；於「pure top-down」相機模式下三軸旋轉均與螢幕平面對齊，體感最好。UI 應提供 axis-preview overlay 協助玩家理解。

### 2.2 GameAction 抽象

`InputMapper` 將所有輸入（鍵盤 / gamepad / 觸控）標準化為以下 enum：

```ts
// src/engine/types/input.ts
export const enum GameAction {
  // 平移
  MoveXNeg = 0,   // 沿 -X 平移一格
  MoveXPos = 1,   // 沿 +X 平移一格
  MoveYNeg = 2,   // 沿 -Y 平移一格
  MoveYPos = 3,   // 沿 +Y 平移一格

  // 旋轉（±90°，經 ADR-0002 §2.4 kick 流程）
  RotateYawNeg  = 10,   // 繞世界 +Z，-90°
  RotateYawPos  = 11,   // 繞世界 +Z, +90°
  RotatePitchNeg = 12,  // 繞世界 +X, -90°
  RotatePitchPos = 13,  // 繞世界 +X, +90°
  RotateRollNeg = 14,   // 繞世界 +Y, -90°（post-spike）
  RotateRollPos = 15,   // 繞世界 +Y, +90°（post-spike）

  // 翻轉（180°，spike 期唯一「roll」入口）
  Flip = 20,            // 繞世界 +Y, +180°

  // 下墜
  SoftDrop = 30,        // 加速累加 gravityAcc（ADR-0003 §2.6）
  HardDrop = 31,        // 立即 LOCKED（ADR-0001 §2.4.2）

  // 系統
  Hold = 40,            // 保留（MVP 未實作；ADR-0005 或後續 ADR）
  Pause = 41,           // FSM 之外的暫停疊層（不影響 tick 遞增）
  Restart = 42,         // 僅 GAME_OVER 狀態下有效（ADR-0001 §2.4.1）
}
```

**設計取捨**：

- 使用 `const enum` 於編譯時內聯為整數，執行時零開銷
- **不含**「rotate 180」以外的多倍角旋轉；連續兩次 `RotateYawPos` 即 180°
- `Flip` 專為 spike 期「1 鍵翻轉」設計；post-spike 可透過連按 **roll** ±90° 兩次達成（`2 × RotateRollPos = Ry(180°) = Flip`）。注意 `2 × RotatePitchPos = Rx(180°) ≠ Flip`（於八面體旋轉群 O 中 Rx180 與 Ry180 為不同元素）。保留 `Flip` enum 供設定型玩家使用
- Enum 值有意留 gap（`0-3`, `10-15`, `20`, `30-31`, `40-42`）以便未來擴充而不衝突 replay

### 2.3 Tick 內動作處理順序

一個 tick 內同時被觸發的多個 `GameAction` 依固定順序處理，確保 replay 決定論：

```
tick(t):
  1. Sample input state → 產生 actions: GameAction[]（可為空）
  2. 依以下順序處理 actions（同類型於同 tick 只取一次，後述）：
     a. Pause    → 若觸發，切換 pause overlay，其餘 action 於本 tick 忽略
     b. Restart  → 僅 GAME_OVER 有效
     c. Rotation (Yaw → Pitch → Roll → Flip)  // 依 enum 值遞增順序
     d. Translation (MoveXNeg → MoveXPos → MoveYNeg → MoveYPos)
     e. SoftDrop → 若持續按住，`gravityAcc += SOFT_DROP_GRAVITY_MULT`（ADR-0003 §2.6）
     f. HardDrop → 立即 LOCKED；忽略後續 action
     g. Hold     → 保留（MVP 無動作）
  3. 執行重力累加 + FSM tick（ADR-0001 §2.4.1）
```

**單次觸發規則（anti-double）**：

- Rotation / Flip：**單次觸發**，按下瞬間產生一次 action；按住不重複（避免無意連轉）
- Translation：**DAS (Delayed Auto Shift)** — 首次觸發後 250 ms 靜默期，之後每 50 ms 重複一次
- SoftDrop：**按住重複**，每 tick 累加加速
- HardDrop：**單次觸發**
- Pause / Restart / Hold：**單次觸發**

**DAS 常數**：

```ts
export const DAS_INITIAL_DELAY_MS = 250 as const;
export const DAS_REPEAT_RATE_MS = 50 as const;
```

（於 ADR-0003 §2.6 之 `SOFT_DROP_GRAVITY_MULT = 20` 之外，本 ADR 新增這兩個常數）

**與 ADR-0001 §2.4.1 tick 之整合**：

- 輸入輪詢於每 tick 起始（60 Hz，約 16.67 ms/tick）
- Action 產生與消化必於同一 tick，不跨 tick 累積
- Pause 期間 tick counter 停止遞增
- **Pause / Restart 屬 UX 系統動作，不錄入 replay stream**：Pause 停 tick 使錄影本身無 pause gap（相鄰 replay event tick 之間仍為連續）；播放端可自行 pause overlay 而不影響 replay 資料。Restart 語意為「離開此局」，於錄影邊界產生新 stream 而非於同 stream 內延續

### 2.4 Spike 期鍵位（鎖定 · MVP 用）

**限制**：ADR-0001 §5 授權「兩軸旋轉 + 一鍵翻轉」；本節鎖定以下映射。

| Physical Key | GameAction | 備註 |
|--------------|-----------|------|
| `ArrowLeft`  | `MoveXNeg` | X 軸負向 |
| `ArrowRight` | `MoveXPos` | X 軸正向 |
| `ArrowUp`    | `MoveYPos` | Y 軸正向（遠離視角側）|
| `ArrowDown`  | `MoveYNeg` | Y 軸負向（靠近視角側）|
| `Q`          | `RotateYawNeg` | 繞世界 +Z，-90° |
| `E`          | `RotateYawPos` | 繞世界 +Z, +90° |
| `W`          | `RotatePitchNeg` | 繞世界 +X, -90° |
| `S`          | `RotatePitchPos` | 繞世界 +X, +90° |
| `F`          | `Flip` | 繞世界 +Y, +180° |
| `Space`      | `HardDrop` | 與 ADR-0001 §2.4.2 硬降一致 |
| `LShift`     | `SoftDrop` | **本 ADR 新增**（見 C1/C2 決議） |
| `Escape` / `P` | `Pause` | UI overlay |
| `R`          | `Restart` | 僅 `GAME_OVER` 狀態有效 |

**Spike 期不含**：`RotateRollNeg` / `RotateRollPos`（roll ±90° 於 spike 未曝光；Flip 為唯一 roll 類動作）、`Hold`。

**C1 / C2 決議**：

- **C1（軟降鍵衝突）**：不採 ↓ 為軟降；`ArrowDown` 保留為 `MoveYNeg`（5×5 井道需要完整 4 方位平移）。ADR-0003 §2.6 之 "(`Down` 按住)" 僅為當時之語意 label，實際 binding 由本 ADR 定為 `LShift`；ADR-0003 於後續 rev.3 補述明「Down 按住為佔位語意，實際鍵位見 ADR-0004 §2.4」
- **C2（Shift 語意重疊）**：`LShift` 於 spike 期作 `SoftDrop`；ADR-0001 §2.6 「Shift 保留 (hold)」需於 ADR-0001 rev.5（隨 ADR-0005 落地）改為 `Tab` 或 `C`。**Hold 於 MVP 未實作 → 無即時衝突**；本 ADR 於 §5 follow-up 明訂

### 2.5 Post-Spike 完整 6 鍵映射（原則 · 不鎖）

**依 ADR-0001 §5 授權，本節僅給原則，具體鍵位於 playtest 後鎖定於 ADR-0004 rev.2 或 ADR-0007。**

**原則**：

1. **6 rotation keys 集中於左手鍵區**（QWEASD 或 QWEASD 之變體），與右手（方向鍵 / drop）分工
2. **相對方位一致性**：
   - Yaw ± 對應「左右轉頭」→ Q/E 或 A/D
   - Pitch ± 對應「上下低頭」→ W/S
   - Roll ± 對應「側傾」→ 剩餘兩鍵
3. **`Flip` 保留為快捷鍵**，即使 6 鍵映射全開；玩家可用 `F` 一鍵 180°，避免高階連按
4. **不使用**：`Ctrl`、`Alt`、`Meta`、`Enter`、`Backspace`（避免與瀏覽器 / OS 快捷衝突）
5. **左手方案（試探 · 候選之一）**：

   | Key | 候選 GameAction | 註 |
   |-----|-----------------|-----|
   | Q / E | `RotateYawNeg` / `RotateYawPos` | 與 spike 一致 |
   | W / S | `RotatePitchNeg` / `RotatePitchPos` | 與 spike 一致 |
   | A / D | `RotateRollNeg` / `RotateRollPos` | **新增**（spike 未開放）|
   | F | `Flip` | 保留快捷 |

   **本表為候選之一，非預設**：具體鍵位待 playtest 資料回寫後於 rev.2 鎖定；本表僅示範左手集中方案結構。

6. **右手保留**：方向鍵維持 X/Y 平移；`Space` 維持硬降；`LShift` 維持軟降（除非 playtest 顯示需重新分配）
7. **不採**「chord」（如 Ctrl+Q）：所有 GameAction 為單一 physical key trigger，避免 chording 與 replay 決定論的相性問題

**Playtest 目標**：

- 記錄每 GameAction 於 spike 期的觸發頻率、成功率、玩家自報疲勞感
- 統計 3D 迷失方向（disorientation）事件（例：連續 3 次以上「無效方向鍵按下」）以評估旋轉軸體感
- 蒐集 ≥ 5 位玩家 × ≥ 30 分鐘實測 → ADR-0004 rev.2

### 2.6 Gamepad 對映 (skeleton)

**MVP scope**：實作 Web Gamepad API polling（60 Hz sample），映射至 GameAction。**具體按鈕綁定於 spike 後鎖定**。

**Xbox controller 試探對映**（不鎖）：

| Button | GameAction | 說明 |
|--------|-----------|------|
| Left Stick / D-Pad | `MoveX/Y` (±) | 支援 4-方位 + DAS |
| LB / RB | `RotateYaw` (±) | 左右肩鍵 |
| LT / RT | `RotatePitch` (±) | 扳機為 pitch |
| Y | `Flip` | Top button |
| A | `HardDrop` | Bottom button（gamepad 慣例：A 為確認/主動作） |
| X | `SoftDrop` | Left button |
| B | `Hold` | Right button（MVP 未實作）|
| Start | `Pause` | |
| Select / Back | `Restart` | GAME_OVER only |

**Roll ±**（post-spike）：待鎖，候選 stick click（L3 / R3）或方向鍵 up/down（若 stick 用於 X/Y）。

**Dead zone / calibration**：

- Analog stick dead zone: `0.15`（絕對值）；outside dead zone 即視為方向鍵 tap
- 不做類比模擬式速度控制；所有動作為離散 GameAction

### 2.7 觸控輸入 (Touch) — 原則

**MVP scope**：**行動裝置為次要支援**（ADR-0001 §2.1 目標平台）。本 ADR 只定義原則，具體 UI 疊層佈局歸 ADR-0007（UI/UX 細節）。

**原則**：

1. **On-screen 虛擬按鈕疊層**：左下方位鍵（±X ±Y）、右下 drop / rotate 群、右上 pause
2. **手勢輔助（可選）**：
   - 單指下滑 → soft drop（等同按住 `LShift`）
   - 雙指下滑 → hard drop（等同 `Space`）
   - 雙指旋轉手勢 → 對應相機平面之 yaw
3. **不採**：free-form 3D 旋轉手勢（用戶研究顯示常導致 disorientation）
4. **可存取性**：所有虛擬按鈕最小點擊區 44 × 44 px（iOS HIG）

### 2.8 重綁 (Rebinding) 與 Replay

**Rebinding**：

- 玩家可自訂 physical key → GameAction 對映（存於 `localStorage`，schema 驗證 per ADR-0001 §5）
- **不可重綁**的固定：
  - `Escape` = `Pause`（無論設定）
  - `F1` / `?` = 顯示鍵位提示 overlay
- Reset-to-default 按鈕於設定頁

**Replay 決定論**：

- Replay 串流錄的是 `GameAction`（int），**不是** physical key code
- 重綁不影響現存 replay 可播性
- Replay stream schema（初版）：

  ```
  header:  { seed: u32, adrHash: string, level0: u8 }
  events:  [ { tick: u32, action: GameAction } ]  // 只錄有 action 的 tick
  ```

- **`adrHash`**：載入時 ADR-0001/0002/0003/0004 的內容 hash（sha256 前 16 字元）；播放前 assert 相符，避免以不同版本 ADR 之常數表播錯 replay
- Replay 長度上限、schema 驗證、禁 `eval` 等安全項承 ADR-0001 §5 之 ADR-0006 條款

**Rebinding 限制（安全）**：

- 讀 `localStorage` 之 rebinding 表以 zod 驗證（key ∈ 白名單、GameAction ∈ enum 有效值）
- **不允許一個 physical key 對映到多個 GameAction**（單 key 觸發歧義會破壞 replay 決定論）
- **允許一個 GameAction 對映到多個 physical key**（alias；例：Escape / P 皆綁 Pause）
- 若驗證失敗，falls back 至本 ADR §2.4 default

## 3. 已考慮的替代方案 (Alternatives Considered)

- **相機相對旋轉軸 (camera-relative frame)**：旋轉軸隨相機朝向動態計算。優點是「向上按 = 向螢幕上翻」永遠成立；缺點是 (a) 若相機切換兩模式（20° tilt vs 純垂直），控制感受變；(b) replay 需錄相機模式，決定論複雜化；(c) tick 內需 frame 轉換。**否決**：用 world frame + camera UI overlay 提示軸方向即可
- **6 鍵映射直接鎖於 MVP**：省 playtest。但 ADR-0001 §5 明訂「勿過早鎖」；且 3D 旋轉軸體感為本作最大 UX 風險（ADR-0001 §4），不 playtest 直接鎖將是高風險決策
- **軟降用 ↓**：與 X/Y 平移中的 -Y 衝突（5×5 井道需要 4 方位平移）。若強行採用，-Y 只能移到其他鍵，rebind 複雜度反而增加。已否決
- **軟降用 `X` / `C` / `V` 等純字母鍵**：無 modifier 語意，但玩家可能誤按（QWEASD 旋轉區旁邊）。`LShift` 為 modifier，與其他 action key 語意層次分離，更安全
- **Chord 快捷（Ctrl+Q = 180 rotate）**：多鍵組合對 replay 之 tick 內狀態序列敏感（同 tick 兩 key press 順序 vs 先後 tick）；已否決，一律 single-key trigger
- **旋轉 auto-repeat**：按住 Q 連續旋轉。已否決，因 3D 旋轉方向切換頻繁、auto-repeat 反而失控；且 Yaw ± 兩鍵按住易造成「無限旋轉不 lock」，破壞 ADR-0001 §2.4.2 lockDelay 15-reset 保護

## 4. 影響 (Consequences)

### 正面

- 世界 frame 旋轉軸 + world-frame `GameAction` → tick / kick / replay 三方對得起，無 frame 轉換 bug
- Spike 期鍵位精簡（僅 5 個 rotation-related keys：Q/E/W/S/F）→ 新手學習曲線緩
- `GameAction` enum + fixed tick order → replay 完全 deterministic
- Rebinding 走 GameAction 抽象 → replay 相容性保證
- Gamepad / touch 有 skeleton，spike 後可直接擴充

### 負面 / 風險

- Roll (繞世界 +Y) 於 20° tilt 相機下的視覺意義不完全直觀；spike 期以 Flip 一鍵繞過此軸，post-spike 6 鍵映射需 playtest 才能安心開放 Roll ±
- `LShift` 為軟降 → ADR-0001 §2.6 之 "Shift (hold)" 需 rev.5 挪至他鍵；MVP 未實作 hold 故無立即問題，但 ADR-0001 rev.5 delta 為必須
- Spike 未開放 Roll ±，於**數學上仍可達所有 fixed states**：`{Rx(±90°), Rz(±90°)}` = {Pitch, Yaw} 已生成完整八面體旋轉群 O(24)；ADR-0002 §2.3 之 BR4=8 / RS4=12 / LS4=12 fixed states 皆可由 Yaw + Pitch 序列到達，`Flip = Ry(180°)` 為冗餘便利快捷（可由 Yaw + Pitch 合成，例：`Ry(180) = Rz(90)·Rx(180)·Rz(-90)`）。實際 UX 風險為「玩家難以規劃 3–4 步旋轉序列」而非狀態不可達；若 spike 期玩家自報「找不到旋轉」比例高，於 ADR-0004 rev.2 開放 Roll ± 以縮短序列長度
- DAS 250 ms / 50 ms 為初始猜值；playtest 後可能收斂為 200/40 或 300/60
- Gamepad 部分為 skeleton；spike 期若無法排入實作，行動端支援延到 v2

### 未決 / 交由 spike / playtest

- Roll ±90° 是否於 post-spike 開放；若開放，key layout 具體鎖定
- DAS 常數的最終值（初始猜 250/50 ms）
- Touch 手勢的具體閾值與 UI overlay
- Gamepad 按鈕的最終綁定
- 是否加入「快速 180°」旋轉 shortcut（現以 `Flip` 覆蓋 roll 180，但 Yaw 180 需連按兩次）

## 5. 後續行動 (Follow-ups)

- 實作 `src/engine/input/mapper.ts`：physical key → GameAction 對映，含 rebinding 讀取、DAS 狀態
- 實作 `src/engine/input/state.ts`：per-tick input state sampler；DAS timer；SoftDrop hold detection
- 實作 `src/engine/types/input.ts`：GameAction enum + tick 內處理順序常數
- 修改 `src/engine/core/fsm.ts`（配合實作階段）：於 `FALLING` / `GROUNDED` 依序消化 GameAction；`Pause` 走 FSM 外部 overlay
- 修改 `src/engine/rng/replay.ts`（新）：replay recording / playback、adrHash 驗證
- 單元測試：
  - `GameAction` enum 值不變（防止 replay 破壞的檢查）
  - Tick 內 action 處理順序（多 action 同 tick 的合成情況）
  - DAS 邊界：250 ms 首次、50 ms 重複
  - Rebinding schema 驗證（合法 / 非法 key、非法 action）
  - Replay adrHash 不符 → 拒播
- **ADR-0001 rev.5 delta（依賴本 ADR）**：§2.6 之 `Shift` 從「保留 (hold)」改為「軟降 (SoftDrop)」；hold 隨 ADR-0005 落地時另指定 key（試探 `Tab` 或 `C`）
- **ADR-0003 rev.3 delta（依賴本 ADR）**：§2.6 表格 "(`Down` 按住)" 註記為佔位語意，實際鍵位 per ADR-0004 §2.4
- Playtest 5+ 位玩家 × 30+ 分鐘 → 資料回寫 ADR-0004 rev.2（Roll ± 開放 / DAS 定值 / 觸控閾值）
- 依 LA4 verdict，本 ADR 若通過正確性 review，正式合入

## 6. 修訂紀錄 (Revision History)

### rev.2 — 2026-07-22 · LA4 round-1 review PASS (0 blocking)；修 3 Should + 2 Nit + status → Accepted

- **S1** (§2.8)：rebinding 方向敘述改寫 — 明確禁止「1 key → 多 action」（破壞 replay 決定論），明確允許「1 action ← 多 key」（alias）
- **S2** (§2.3)：Pause / Restart 於 replay 之機制明寫 — 兩者為 UX 系統動作，**不錄入** replay stream；Pause 停 tick 使錄影本身無 gap；Restart 語意為錄影邊界
- **S3** (§2.2)：Flip 之數學 rationale 錯誤修正 — 只有 `2 × RotateRollPos = Ry(180°) = Flip`；`2 × RotatePitchPos = Rx(180°) ≠ Flip`（八面體群 O 中 Rx180 ≠ Ry180）。原稿誤寫「pitch/roll ±90° 兩次」
- **N1** (§4)：旋轉群覆蓋性敘述修正 — `{Rx(±90°), Rz(±90°)}` 已生成完整 O(24)，spike 期 Yaw+Pitch 即可到達所有 fixed states；Flip 為冗餘便利快捷。UX 風險為「序列長」，非「狀態不可達」
- **N2** (§2.5 pt5)：試探表加註「候選之一，非預設；具體鍵位待 playtest rev.2 鎖定」
- LA4 review 記錄：`brain get oab/adr/0004-review-round1`

### rev.1 — 2026-07-22

初稿。依 ADR-0001 rev.4 §5 對「3D 輸入 UX 與鍵位對照」的授權（spike = 2-軸旋轉 + 1 翻轉，勿過早鎖 6 鍵映射），並：

- 補上 GameAction 抽象、tick 內處理順序、replay 決定論 schema
- 解 C1（軟降鍵不採 ↓；改用 `LShift`）
- 解 C2（`LShift` 暫佔 Shift 語意；ADR-0001 §2.6 rev.5 delta 已列於 §5 follow-ups）
- 明訂旋轉軸於世界 frame 定義，避免相機切換造成控制感錯亂
