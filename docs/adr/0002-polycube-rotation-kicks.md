---
title: ADR-0002 Polycube Rotation Kicks
type: decision
status: accepted
adr_id: "0002"
repo: topweedev/tetris-XL
path: docs/adr/0002-polycube-rotation-kicks.md
tags: [adr, tetris-xl, polycube, rotation, wall-kick, floor-kick]
---

# ADR-0002: Polycube 集合、旋轉正規化與 Kick 偏移表

- 狀態：Accepted
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：ADR-0001（rev.4）§2.2、§2.4.3、§2.4.4

## 1. 背景 (Context)

ADR-0001 rev.4 已定義：

- Polycube 由 1–4 個 unit cell 組成（§2.2）
- `Piece` 資料結構：`typeId`、`cellCount`、`cells: Int8Array(12)`（未用槽 = `0x7F`）、`origin: Int8Array(3)`、`rotationStateId`
- 旋轉查表模式（載入時展開所有唯一旋轉、以正規化字串去重）
- Wall/floor-kick 概念：旋轉失敗時嘗試偏移，全失敗保留原態
- Spawn-kick 與旋轉 kick **不共用同一表**（rev.4 New-S2）
- 井道 `5 × 5 × 12`；`z=0` 井底、`z=11` 井頂

本 ADR 補上實作級細節：完整 polycube 枚舉、旋轉正規化演算法、`origin` 慣例、wall/floor-kick 與 spawn-kick 偏移表。

## 2. 決策 (Decision)

### 2.1 Polycube 集合（自由 polycube，free polycubes）

以「自由多方塊 (free polycube)」為單位定義（旋轉等價視為同一形狀，鏡像視為不同——保留 chiral pair）。載入時針對每個自由 polycube 展開所有唯一固定旋轉狀態。

參考：OEIS A000162（自由 polycubes 數量）— 大小 1、2、3、4 分別為 1、1、2、8。

| bucket | typeId | 短名 | 描述 | cells 相對座標 (canonical form) |
|--------|--------|------|------|--------------------------------|
| **1-cell** | `M1` | Monocube | 單顆 | `(0,0,0)` |
| **2-cell** | `D2` | Dicube | 兩顆同軸相連 | `(0,0,0), (1,0,0)` |
| **3-cell** | `I3` | Straight tricube | 三顆一直線 | `(0,0,0), (1,0,0), (2,0,0)` |
| 3-cell | `V3` | Right-angle tricube (L3) | 兩顆連一顆垂直 | `(0,0,0), (1,0,0), (0,1,0)` |
| **4-cell** | `I4` | I-tetracube | 四顆一直線 | `(0,0,0), (1,0,0), (2,0,0), (3,0,0)` |
| 4-cell | `O4` | Square tetracube | 2×2×1 | `(0,0,0), (1,0,0), (0,1,0), (1,1,0)` |
| 4-cell | `L4` | L-tetracube (planar) | 三直線 + 短邊 | `(0,0,0), (1,0,0), (2,0,0), (0,1,0)` |
| 4-cell | `T4` | T-tetracube (planar) | 三直線 + 中央垂直 | `(0,0,0), (1,0,0), (2,0,0), (1,1,0)` |
| 4-cell | `S4` | S/Z-tetracube (planar) | 錯位對 | `(0,0,0), (1,0,0), (1,1,0), (2,1,0)` |
| 4-cell | `RS4` | Right-screw tetracube (chiral 3D) | 螺旋，右手 | `(0,0,0), (1,0,0), (1,1,0), (1,1,1)` |
| 4-cell | `LS4` | Left-screw tetracube (chiral 3D) | 螺旋，左手（`RS4` 之鏡像） | `(0,0,1), (1,0,1), (1,1,1), (1,1,0)` |
| 4-cell | `BR4` | Branch / Tripod tetracube (3D) | 三軸各出一顆 + 中央 | `(0,0,0), (1,0,0), (0,1,0), (0,0,1)` |

共 **12 種自由 polycube**（1 + 1 + 2 + 8）。實作以 `typeId` 短名為鍵。展開所有固定旋轉狀態後，總計 fixed polycubes 數 ≈ 1 + 3 + 3 + 12 + ... = **依 §2.3 演算法產生**，實測時 assert 對應 OEIS 或已知計數。

### 2.2 `origin`（旋轉樞紐）與 `anchor` 慣例

- 旋轉表儲存的每個 fixed state，其 `cells` 都是依 §2.3 `normalize()` 後的座標，亦即 `min(x,y,z) = (0,0,0)`；這組座標稱為該 state 的 **local frame**。
- 每個 fixed state 另儲存該 state 的 `origin`（旋轉樞紐在其 local frame 中的位置）。它可不是 `(0,0,0)`，因為正規化平移會隨旋轉搬移質心。
- `origin` 由該 state 的幾何質心取整數近似：
  ```
  origin = round( sum(cells) / cellCount )
  ```
  對稱時若有多個候選整數點，以「x 最小、y 最小、z 最小」的字典序決斷（deterministic）。
- 世界座標只維護一個 `anchor: Int8Array(3)`，表示該 state local frame 的 `(0,0,0)` 對應的場地座標；因此 `worldCell[i] = anchor + cells[i]`。
- 載入時展開旋轉仍使用 `cells[i]_new = R * (cells[i] - origin) + origin`，其中 `R ∈ SO_24`；此公式**僅用於載入時產生旋轉表**，不是 tick 時的即時運算。tick 時查詢下一個 `rotationStateId`，並依 §2.6 更新 `anchor`。
- 旋轉切換時，先取 `origin_cur` 與 `origin_new`，令 `anchor_new = anchor_cur + (origin_cur - origin_new)`，使玩家感覺 pivot 不跳；再於 `anchor_new` 上疊加 §2.4 的 kick `(dx,dy,dz)`。kick 全失敗則保留原 rotation state 與原 anchor。

### 2.3 旋轉正規化演算法

載入時對每個自由 polycube 執行：

```ts
function enumerateFixedStates(base: Cell[]): Cell[][] {
  const seen = new Map<string, Cell[]>();
  for (const R of SO24) {                    // 24 個立方體旋轉矩陣
    const rotated = base.map(c => R.apply(c));
    const normalized = normalize(rotated);   // 平移使 min(x,y,z) = (0,0,0)
    const key = canonicalKey(normalized);    // 排序後 join
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return [...seen.values()];
}

function normalize(cells: Cell[]): Cell[] {
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  const minZ = Math.min(...cells.map(c => c.z));
  return cells.map(c => ({ x: c.x - minX, y: c.y - minY, z: c.z - minZ }));
}

function canonicalKey(cells: Cell[]): string {
  return cells
    .map(c => `${c.x},${c.y},${c.z}`)
    .sort()
    .join(';');
}
```

**SO24 產生方式**：使用 24 個以純整數矩陣表示的元素，可寫死為長度 24 的 `Int8Array[9]` 陣列（每個 3×3）或 lookup table。生成時可從 6 個 face-orientation × 4 個 in-face rotation 遞推。

**正確性驗證**：
- Assert `enumerateFixedStates(monocube).length === 1`
- Assert `enumerateFixedStates(dicube).length === 3`
- Assert `enumerateFixedStates(I3).length === 3` / `V3.length === 12`
- Assert `enumerateFixedStates(I4).length === 3`、`O4 === 3`、`L4 === 12`、`T4 === 12`、`S4 === 12`
- Assert `enumerateFixedStates(RS4).length === 12`、`LS4.length === 12`（且 `RS4 ∩ LS4 = ∅`，證明 chiral 分離成功）
- Assert `enumerateFixedStates(BR4).length === 8`

以上 assert 全通過方視為 polycube 表載入成功；任一失敗立即 throw，避免遊戲以錯誤旋轉表運作。

### 2.4 Wall / Floor-kick 偏移表

本檢查與 §2.5 spawn-kick 遵守 ADR-0001 §2.4.4 的 spawn 緩衝區規則。

旋轉指令流程：

```
1. 計算 target rotationStateId 對應之 cells（查表）
2. 對每個 kick 偏移 (dx, dy, dz)（自 offsets[direction] 依序）:
     - 將 piece anchor 加上 (dx, dy, dz)
     - 檢查所有 cell 是否位於 x∈[0,4], y∈[0,4], z∈[0,11 + pieceMaxDz]
     - 對 `z ∈ [0,11]` 的 cell，確認 `board[idx(x,y,z)] == 0`；`z > 11` 的 cell 只做邊界檢查，不查 board。`z∈[12,11 + pieceMaxDz]` 為 spawn 緩衝區，不寫入 board，也不讀取 board
     - 若通過 → 提交旋轉並提交 anchor 偏移，回傳 success
3. 全部 offsets 失敗 → 保留原 rotationStateId 與原 anchor（旋轉無效）
```

**偏移列表 `offsets[direction]`**（`direction` = 旋轉方向 ID，共 6 個：pitch±、yaw±、roll±；各方向可用同一表，若需差異化留待後續實驗）：

```
kickOffsets = [
  ( 0,  0,  0),   // 原位（必試第一個）
  (+1,  0,  0),   // +X 側推
  (-1,  0,  0),
  ( 0, +1,  0),
  ( 0, -1,  0),
  ( 0,  0, +1),   // 向上頂（floor-kick 反向；wall-kick 貼牆時抬離）
  (+1,  0, +1),   // 對角線 kick
  (-1,  0, +1),
  ( 0, +1, +1),
  ( 0, -1, +1),
  (+2,  0,  0),   // 兩格 kick（少見；4-cell I 型可能需要）
  (-2,  0,  0),
  ( 0, +2,  0),
  ( 0, -2,  0),
]
```

`pieceMaxDz` 是該 `typeId` 的最大 z 範圍（載入時計算並固定）；其最大值為 3，因此旋轉檢查的上界最多為 `z=14`。共 **14 個 candidate**。5×5 井道空間狹小、4-cell piece 佔用比例高，14 個涵蓋率經 spike 期驗證後可裁剪。

**設計原則**：
- 不含 `(0, 0, -1)`：向井底頂進沒有物理意義（重力方向）。
- 不含 `|dx| > 2` 或 `|dy| > 2`：井寬僅 5，過大偏移意義不大。
- **不共用於 spawn-kick**（見 §2.5）。

**成本**：14 次碰撞檢查 × 每次最多 4 cell = 56 次索引運算，均為 typed-array 讀取，實測應 < 10 µs。

### 2.5 Spawn-kick 偏移表

**與 §2.4 分離**。因 spawn 位固定於 `(2, 2, 11)`（井口中心，見 ADR-0001 §2.4.4），且 `(0, 0, +1)` 會把 piece 推入非法緩衝區之外，spawn-kick 不應含垂直向上偏移。

**spike 期預設**：空表（僅檢查原位）。

```
spawnKickOffsets = []   // MVP: 只在 (2, 2, 11) 檢查一次；碰撞即 game over
```

**後續擴充選項**（暫不採用）：

```
spawnKickOffsets_v2 = [
  ( 0, 0, 0),   // 原位
  (+1, 0, 0),   // 水平微調（若中心被占用，往邊緣塞）
  (-1, 0, 0),
  ( 0, +1, 0),
  ( 0, -1, 0),
]
```

任何未來擴充**禁止**加入 `(0, 0, ±1)`：向下有壓入既有堆積之風險，向上把 piece 推出井口。

### 2.6 資料格式與載入

Polycube 表以 TypeScript 常數定義於 `src/engine/pieces/definitions.ts`：

```ts
export const POLYCUBE_DEFS: Record<TypeId, PolycubeDef> = {
  M1: { cells: [[0, 0, 0]] },
  D2: { cells: [[0, 0, 0], [1, 0, 0]] },
  I3: { cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0]] },
  // ... 依 §2.1 表
};
```

載入函式 `buildRotationTable()`：

1. 對每個 `PolycubeDef` 執行 §2.3 演算法
2. 對每個 fixed state 產生 `Piece` cells (`Int8Array(12)`，含哨兵 `0x7F`)
3. 產生 `rotationStateId` 對應的鄰接圖（記錄每個 state 沿六個旋轉方向的下一個 stateId），供 tick 時 O(1) 查詢
4. 執行 §2.3 assert；任一失敗即 throw

結果緩存為模組級單例；不做動態變更。

### 2.7 Bag / 出牌整合

（本 ADR 不改變 ADR-0001 §2.3 的 7-bag 加權策略；僅補充：）

- Bag RNG 產出 `typeId` 序列
- 每個 piece spawn 時：
  1. 依 `typeId` 取出對應之 initial `rotationStateId`（預設為載入時的第一個 fixed state，通常對應 canonical 座標）
  2. 依 §2.5 檢查 spawn 位
  3. 若失敗，觸發 ADR-0001 §2.4.3 game over

## 3. 已考慮的替代方案 (Alternatives Considered)

- **每 tick 即時矩陣乘法**：不預算表，旋轉時 apply `R * (cell - origin)`。優點是省 8 KB 記憶體；缺點是每次旋轉 4 × 9 = 36 次乘加，且無 canonical 去重可能導致 orientation 累積漂移。**否決**：本表小、cache-friendly、簡單。
- **SRS 直接搬 2D 表**：SRS 為 2D 專屬，含 T-spin 特化偏移；3D 無對應規範，直接類推風險大。改為自訂 14-offset 表 + spike 驗證。
- **共用旋轉與 spawn kick 表**：LA5 已於 rev.4 New-S2 反對；`(0, 0, +1)` 語意衝突。已分離。
- **僅用 free polycubes 不做旋轉去重**：每個 free polycube 直接展開全 24 種 R 矩陣，不合併重複。優點簡單；缺點對稱形（如 I3、O4、BR4）會產生 8–21 個等價 duplicate state，浪費記憶體且 rotationStateId 圖不清晰。採取正規化去重。

## 4. 影響 (Consequences)

### 正面
- Polycube 集合與旋轉表在載入時定案，tick path 只查表，O(1) 且無矩陣運算。
- Chiral pair (`RS4` / `LS4`) 顯式編列，避免鏡像意外合併。
- Kick 表數字明確，行為可預測；assert 保證載入正確性。
- Spawn-kick 分離解除 `(0, 0, +1)` 語意衝突。

### 負面 / 風險
- 14-offset kick 表在 5×5 井道**尚未驗證**是否過大或過小；需 spike 期收集失敗率 / 成功偏移分佈，回頭修剪。
- BR4（Tripod）在 5×5 井中旋轉幾何體積佔比高，可能大量觸發 kick 甚至完全無法旋轉；spike 需觀察。
- 若後續加入 5-cell polycube（pentacube，OEIS A000162 = 29），本 ADR 需擴充；目前明確 out-of-scope。

### 未決 / 交由 spike 驗證
- Kick 表逐 offset 命中率統計；spike 後回頭寫入 ADR-0002 rev.2 決定裁剪版。
- 是否對不同 rotation direction 使用不同 kick 表（如 pitch vs yaw）；預設共用，spike 觀察是否需差異化。

## 5. 後續行動 (Follow-ups)

- 實作 `src/engine/pieces/rotations.ts`：SO24、`normalize`、`canonicalKey`、`enumerateFixedStates`。單元測試涵蓋 §2.3 全部 assert。
- 實作 `src/engine/pieces/definitions.ts`：§2.1 表。
- 實作 `src/engine/pieces/kick.ts`：§2.4、§2.5 kick 邏輯。單元測試涵蓋：邊界卡牆、地面 kick、chiral 分離。
- Spike 執行時收集 kick 命中率，寫回 ADR-0002 rev.2。
- **依 LA5 verdict**，本 ADR 若通過 LA3 review，正式合入。

## 6. 修訂紀錄 (Revision History)

### rev.3 — 2026-07-22 · 通過 review：LA3 round-1 正確性 PASS、LA5-substitute (LA1 代審) round-1 安全/簡化 PASS；status → Accepted。8 條非-blocking SUGGEST 記於 `brain get oab/adr/0002-review-round2-la5-sub`，留待 rev.4 或 spike 期。

### rev.2 — 2026-07-22 · 依 LA3 round-1 review 修 3 blocker (§2.1 LS4 正規化 / §2.2 origin-anchor 語意 / §2.4 z 上界含 spawn 緩衝)

### rev.1 — 2026-07-22
初稿。依 ADR-0001 rev.4 §2.2 / §2.4.3 / §2.4.4 展開。
