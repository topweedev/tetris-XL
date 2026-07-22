---
title: ADR-0006 Persistence and Replay Format
type: decision
status: proposed
adr_id: "0006"
repo: topweedev/tetris-XL
path: docs/adr/0006-persistence-and-replay.md
tags: [adr, tetris-xl, persistence, replay, localstorage, url-query, adrhash, schema, security]
---

# ADR-0006: 持久化與 Replay 格式（localStorage / URL / stream schema / adrHash / 安全）

- 狀態：Proposed
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：
  - ADR-0001 rev.4 §2.1 / §2.4 / §2.7 / §2.8 / §5（S8 硬性條款）
  - ADR-0002 rev.3 §2.4（kick 表為 adrHash 涵蓋源）
  - ADR-0003 rev.2 §2.1–§2.7（難度 / 重力 / bag / 計分基座為 adrHash 涵蓋源）
  - ADR-0004 rev.2 §2.2 / §2.3 / §2.8（GameAction 枚舉、tick 順序、replay 決定論、rebinding schema）
  - ADR-0005 rev.2 §2.1 / §2.7（Hold state、`HOLD_KEY_CODE` 之 rebinding 交互）

## 1. 背景 (Context)

ADR-0001 rev.4 §5 明訂本 ADR 之範圍與**硬性安全條款**（S8）：

> ADR-0006（條件觸發）：持久化與重播格式。**若引入 `localStorage` / URL query state：**
> - 一律以 schema (zod 或等價) 驗證讀入資料。
> - 設定每欄長度上限；重播序列總長度上限。
> - **禁止 `eval`、`Function` 動態執行任何字串來源**。
> - CI 建置環境不注入無謂 token 到靜態成品。

ADR-0004 rev.2 §2.8 已勾勒 replay stream 初版 schema，並將以下項目**明文推至本 ADR**：

> Replay 長度上限、schema 驗證、禁 `eval` 等安全項承 ADR-0001 §5 之 ADR-0006 條款

ADR-0005 rev.2 §5 追加：

> replay 播放需支援 hold slot 狀態重建

本 ADR 補齊：

- **儲存範圍**：哪些狀態進 `localStorage`、哪些走 URL query、哪些純 in-memory
- **Replay stream schema**：header / events / footer 之欄位、二進位表達、壓縮策略、序列上限
- **`adrHash` 演算法**：build-time 計算之來源檔案清單、hash 函式、截斷長度、runtime assert 時機
- **Rebinding 表 schema**：延續 ADR-0004 §2.8 之 zod 驗證細節
- **Zod schema 目錄**：`src/engine/persistence/schema.ts` 各表結構、上限、預設值
- **安全硬規則**：`eval` / `new Function` / `import()` 動態載入之禁令、CI 環境變數白名單
- **Replay 播放狀態重建**：`GameState` 完整重建流程（含 hold slot、combo、b2b、level、score 等 ADR-0005 新欄位）
- **Migration 政策**：schema version 欄位、未知版本 fallback、spike 期不做遷移
- **URL query state**：`?replay=` / `?seed=` 之編碼、上限、共享語意

## 2. 決策 (Decision)

### 2.1 儲存分層 (Persistence Tiers)

三層儲存，語意層次由持久到短暫：

| 層級 | 媒介 | 內容 | Schema 驗證 | 上限 |
|------|------|------|--------------|------|
| **L1 · Persistent** | `localStorage` | 玩家設定、high scores、rebinding 表 | zod（本 §2.5） | 每 key ≤ 4 KiB（`4096` bytes UTF-8） |
| **L2 · Shareable** | URL query string | 分享 replay、指定 seed | zod（本 §2.5） | 整段 URL ≤ 8 KiB（含 origin+path），query ≤ 6 KiB |
| **L3 · Runtime** | in-memory `GameState` | 當前遊戲進度、combo/b2b/hold slot、事件 bus | 型別靜態保證（TypeScript） | N/A（GC 管理） |

**L1 · localStorage keys**（全部以 namespace prefix `tetris-xl:` 起頭、以 `:v<N>` 收尾標明 schema 版本）：

| Key | 內容 | Schema (§2.5) |
|-----|------|---------------|
| `tetris-xl:rebinding:v1` | Physical key → GameAction 對映；alias 表 | `RebindingSchema` |
| `tetris-xl:highscores:v1` | 最高分紀錄（每 level 一列，含 seed / adrHash / date） | `HighscoresSchema` |
| `tetris-xl:settings:v1` | 音量、camera 模式、touch 開關、reduce-motion | `SettingsSchema` |
| `tetris-xl:last-replay:v1` | 上一局遊戲之完整 replay stream（本機自動保存） | `ReplayStreamSchema` |

**L2 · URL query params**（僅列本 ADR 定義者；其他業務 param 另訂）：

| Param | 內容 | Schema (§2.5) |
|-----|------|---------------|
| `replay` | Base64url 編碼之 `ReplayStreamSchema` binary（gzip 壓縮，見 §2.2） | `ReplayUrlSchema` |
| `seed` | 指定 RNG seed（十進位 u32，1-10 位數字） | `SeedUrlSchema` |

**L3 · Runtime**：在 §2.7 replay 播放時，`GameState` 由 `ReplayStreamSchema` + `adrHash` 對照之常數表逐 tick 重建；播放引擎與正常遊戲共用同一 `fsm.step()` 函式（純函式），保證決定論。

**明文排除項**（**不進**任何持久層）：

- 當前遊戲進行中之 GameState（除 §2.6 「意外中斷保留」外，正常結束時 flush 進 `tetris-xl:last-replay:v1`）
- Tick counter 之絕對值（replay 錄相對 tick 於 `events[i].tick`；重建時從 0 起）
- 事件 bus 內容（每 tick 重新生成）
- Rendering / three.js 狀態（每 frame 重新生成）
- 任何 secret / token（無論來源）

### 2.2 Replay Stream Schema（binary，替代 ADR-0004 §2.8 初版之 JSON 草稿）

**設計原則**：

- **決定論優先**：僅記錄 `GameAction` + 相對 tick；GameState 由 §2.7 引擎重建，不錄中間 state
- **緊湊**：spike 期預估上限 1 局 60 min × 60 Hz = 216,000 tick；假設每 tick 平均 0.3 個 action，events 約 65,000 筆
- **壓縮**：整段 stream 走 gzip（`CompressionStream('gzip')`，Chrome 80+ / FF 113+ / Safari 16.4+ 原生支援）
- **可移植**：Base64url 於 URL / 檔案下載 / clipboard 皆安全

**Binary layout（gzip 壓縮前）**：

```
+--------------------+------------------+---------------------+
| header (fixed 32B) | events (var)     | footer (fixed 40B)  |
+--------------------+------------------+---------------------+
```

**Header**（32 bytes）：

| offset | size | 欄位 | 說明 |
|--------|------|------|------|
| 0 | 4 | `magic` | ASCII `"TXR1"`（tetris-XL replay v1） |
| 4 | 2 | `schemaVersion` | `u16` LE = `1` |
| 6 | 2 | reserved | `0x0000`（未來擴充） |
| 8 | 4 | `seed` | `u32` LE，RNG seed（bag / spawn 之唯一亂數源） |
| 12 | 16 | `adrHash` | sha256 前 16 字元之 hex-decoded bytes（見 §2.3） |
| 28 | 1 | `level0` | `u8`，起始 level（1-20；load-time assert 1 ≤ v ≤ MAX_LEVEL） |
| 29 | 1 | reserved | `0x00`（保留；未來若引擎需 per-replay 常數（如 max-level bump），可佔用此欄位並升 `schemaVersion`） |
| 30 | 2 | `flags` | `u16` LE，bit0=`autoSaved`（本地自動保存 vs 手動下載），bit1-15 保留 = 0 |

**Events**（可變長度；每筆 6 bytes）：

| offset | size | 欄位 | 說明 |
|--------|------|------|------|
| 0 | 4 | `tick` | `u32` LE，事件發生之相對 tick（起始 tick=0） |
| 4 | 1 | `action` | `u8`，`GameAction` enum 值（0-3, 10-15, 20, 30-31, 40-42；ADR-0004 §2.2） |
| 5 | 1 | reserved | `0x00` |

**排除 events**：`Pause = 41` 與 `Restart = 42` **不錄入** replay stream（承 ADR-0004 §2.3 §2.8）；播放端亦不需處理該兩 action。**Hold = 40**、`SoftDrop = 30`、`HardDrop = 31` 皆錄入。

**Footer**（40 bytes）：

| offset | size | 欄位 | 說明 |
|--------|------|------|------|
| 0 | 4 | `magic` | ASCII `"TXRE"`（tetris-XL replay end） |
| 4 | 4 | `eventCount` | `u32` LE，events 總筆數（供 load 時驗證：`(bodyLen - 32 - 40) / 6 === eventCount`） |
| 8 | 4 | `finalTick` | `u32` LE，遊戲結束時之 tick（≥ 最後一筆 event.tick） |
| 12 | 4 | `finalScore` | `u32` LE，final score（0 ≤ v ≤ 2^32 - 1；per ADR-0005 §2.5 最大單 lock 190,000，累計上限遠低於此） |
| 16 | 1 | `outcome` | `u8`，`0=game_over`, `1=user_quit`, `2=restart_out`, `3-255` 保留 |
| 17 | 1 | `finalLevel` | `u8`，`1-20`；load 時 assert 1 ≤ v ≤ MAX_LEVEL |
| 18 | 22 | `checksum` | `sha256(header || events)` 前 22 bytes；load 時 assert 相符（偵測 corruption） |

**壓縮流程**（write）：

```
1. bytes = concat(header, events, footer)
2. gzipped = gzip(bytes)
3. onDisk / onUrl = base64url(gzipped)
```

**解壓流程**（read）：

```
1. gzipped = base64urlDecode(input)
2. if gzipped.length > MAX_COMPRESSED_BYTES: reject      # §2.5 上限
3. bytes = gunzip(gzipped)
4. if bytes.length > MAX_UNCOMPRESSED_BYTES: reject
5. header = bytes[0..32]; assert magic === "TXR1"
6. eventCount = read footer.eventCount
7. assert bytes.length === 32 + eventCount * 6 + 40
8. assert footer.magic === "TXRE"
9. assert sha256(header || events).slice(0, 22) === footer.checksum
10. assert header.adrHash === runtime.adrHash（§2.3）
11. yield { header, events, footer }
```

**上限**（於 §2.5 `ReplayStreamSchema` load-time assert）：

- `MAX_EVENTS = 262_144`：對應 60 min × 60 Hz × 0.72 action/tick 之寬鬆估算
- `MAX_UNCOMPRESSED_BYTES = 32 + 262_144 × 6 + 40 = 1_572_936`（~1.5 MiB）
- `MAX_COMPRESSED_BYTES = 512 * 1024`（512 KiB；壓縮後 typical ratio 30-50%，此值為 3x 安全邊際）
- `MAX_URL_REPLAY_BASE64 = 6 * 1024`（6 KiB base64url ≈ 4.5 KiB gzip payload；URL query 上限 §2.1 §2.4）

### 2.3 `adrHash` 演算法

**目的**：確保 replay 之常數表（bag 權重、gravity 表、鍵位、計分公式 etc.）與播放時之引擎一致；若 ADR 內容變動導致常數表變動、adrHash 隨之變動、舊 replay 被 assert 拒絕而非以錯誤常數表播出詭異結果。

**輸入來源**（build-time）：

以下 ADR markdown 檔的**原始位元組**（`fs.readFileSync` 之 Buffer；不做正規化）串接，順序如清單所示（避免 map 順序依賴）：

```
docs/adr/0001-project-architecture.md
docs/adr/0002-polycube-rotation-kicks.md
docs/adr/0003-difficulty-and-scoring.md
docs/adr/0004-input-ux-and-keymap.md
docs/adr/0005-hold-combo-spin-b2b-scoring.md
```

**明確排除**：

- **本 ADR-0006 檔本身**：本 ADR 描述 replay 格式與持久化，不影響「同一批常數下 replay 播放結果」；納入將導致每次修 ADR-0006 皆使舊 replay 失效，違反設計意圖
- 尚未存在之 ADR-0007+：不列入清單；未來新增常數-性 ADR 時，更新本清單並升 `schemaVersion` (§2.2 header) + `bumped adrHash` 檔位

**演算法**：

```ts
// build-time：於 vite plugin / build script 執行
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ADR_FILES_FOR_HASH = [
  'docs/adr/0001-project-architecture.md',
  'docs/adr/0002-polycube-rotation-kicks.md',
  'docs/adr/0003-difficulty-and-scoring.md',
  'docs/adr/0004-input-ux-and-keymap.md',
  'docs/adr/0005-hold-combo-spin-b2b-scoring.md',
] as const;

function computeAdrHash(): string {
  const h = createHash('sha256');
  for (const path of ADR_FILES_FOR_HASH) {
    h.update(readFileSync(path));   // raw bytes；無 LF/CRLF 正規化
  }
  return h.digest('hex').slice(0, 32);   // 前 32 hex chars = 16 bytes
}
```

**注入策略**：

- Vite plugin 於 build 期把 `computeAdrHash()` 之結果替換 `import.meta.env.__ADR_HASH__` string 常數
- Runtime `ReplayEngine` 讀 `__ADR_HASH__` 做 assert
- Dev 模式 `vite dev` 每次啟動亦重算，避免 HMR 期 adrHash 失效

**Runtime assert**：

```ts
// src/engine/persistence/replay-load.ts
function loadReplay(input: Uint8Array): ReplayStream {
  const parsed = parseReplayBinary(input);
  if (bytesToHex(parsed.header.adrHash) !== import.meta.env.__ADR_HASH__) {
    throw new ReplayIncompatibleError(
      `replay 為不同版本之 ADR 錄製；current=${import.meta.env.__ADR_HASH__}, replay=${bytesToHex(parsed.header.adrHash)}`
    );
  }
  return parsed;
}
```

**CRLF 敏感性**：因 `readFileSync` 走 raw bytes，Windows 上 clone 時若 `core.autocrlf=true` 造成 CRLF，build 出來之 `adrHash` 會不同於 LF 版。**對策**：repo 根目錄之 `.gitattributes` 明訂 `docs/adr/*.md text eol=lf`（隨本 ADR 之 PR 一併新增）。

### 2.4 URL Query State

**支援 param**：

**`?replay=<base64url>`**：分享完整 replay。編碼為 §2.2 之 gzip base64url stream。上限見 §2.5 `ReplayUrlSchema.maxLength = MAX_URL_REPLAY_BASE64 = 6144`（≈ 4.5 KiB gzipped，約對應 ~40k events；長 replay 建議走檔案下載而非 URL）。

**`?seed=<u32-decimal>`**：以指定 seed 開新局，供比賽 / 挑戰。範圍 `0 <= seed <= 4_294_967_295`，字串長度 1-10 位；zod 驗證 `SeedUrlSchema.regex = /^\d{1,10}$/` + 數值範圍。

**衝突處理**：

- 若同時給 `?replay=` 與 `?seed=`：`?replay=` 優先，`?seed=` 忽略（replay 已含 seed）
- 若 `?replay=` 解碼失敗：顯示 error toast 「replay 損毀或版本不符」，落到主選單，**不**自動起新局

**分享 UX**：

- 「分享 replay」按鈕生成 URL 前先檢查 base64 長度 ≤ 6144；超過則彈提示「replay 過長，請下載檔案分享」
- 沒有自動短連結 / 第三方 API 呼叫（避免任何 outbound token 需求）

### 2.5 Zod Schema 目錄

**`src/engine/persistence/schema.ts`**：

```ts
import { z } from 'zod';

// ─── L1 · localStorage ──────────────────────────────────────

export const RebindingSchema = z.object({
  version: z.literal(1),
  bindings: z.array(
    z.object({
      key:    z.string().max(32).regex(/^[A-Za-z0-9]+$/),  // KeyboardEvent.code 白名單子集
      action: z.number().int().min(0).max(42),             // GameAction enum 值範圍
    })
  ).max(64),   // 每個 action 最多 5 alias、13 個 spike action → 65；設 64 稍緊，強迫刪冗余
});

export const HighscoresSchema = z.object({
  version: z.literal(1),
  entries: z.array(
    z.object({
      score:    z.number().int().nonnegative().max(4_294_967_295),
      level:    z.number().int().min(1).max(20),
      seed:     z.number().int().nonnegative().max(4_294_967_295),
      adrHash:  z.string().length(32).regex(/^[0-9a-f]{32}$/),
      date:     z.string().datetime(),   // ISO 8601
    })
  ).max(100),   // 每個 level 5 entries × 20 level = 100
});

export const SettingsSchema = z.object({
  version: z.literal(1),
  volume:       z.number().min(0).max(1),
  cameraMode:   z.enum(['tilt-20', 'top-down']),
  touchEnabled: z.boolean(),
  reduceMotion: z.boolean(),
});

// Replay 於 localStorage 亦以 binary + base64url 儲存（略）
export const ReplayLocalStorageSchema = z.object({
  version: z.literal(1),
  data:    z.string().max(8192),   // base64url gzip payload；比 URL 上限稍大（本機儲存可再放 30%）
});

// ─── L2 · URL Query ─────────────────────────────────────────

export const ReplayUrlSchema = z.string()
  .max(6144)                          // MAX_URL_REPLAY_BASE64
  .regex(/^[A-Za-z0-9_-]+$/, 'base64url only');

export const SeedUrlSchema = z.string()
  .regex(/^\d{1,10}$/, 'u32 decimal only')
  .transform(s => parseInt(s, 10))
  .refine(n => n >= 0 && n <= 4_294_967_295, 'u32 range');

// ─── 二進位 header/events/footer 解構後之 zod schema ────────

export const ReplayStreamSchema = z.object({
  header: z.object({
    schemaVersion: z.literal(1),
    seed:          z.number().int().nonnegative().max(4_294_967_295),
    adrHash:       z.string().length(32).regex(/^[0-9a-f]{32}$/),
    level0:        z.number().int().min(1).max(20),
    flags:         z.number().int().min(0).max(0xffff),
  }),
  events: z.array(
    z.object({
      tick:   z.number().int().nonnegative().max(4_294_967_295),
      action: z.number().int().min(0).max(42),
    })
  ).max(262_144),   // MAX_EVENTS
  footer: z.object({
    eventCount: z.number().int().nonnegative().max(262_144),
    finalTick:  z.number().int().nonnegative().max(4_294_967_295),
    finalScore: z.number().int().nonnegative().max(4_294_967_295),
    outcome:    z.number().int().min(0).max(2),
    finalLevel: z.number().int().min(1).max(20),
  }),
})
.refine(
  s => s.footer.eventCount === s.events.length,
  'footer.eventCount mismatch',
)
.refine(
  s => s.events.every((e, i) => i === 0 || e.tick >= s.events[i - 1].tick),
  'events must be tick-monotonic non-decreasing',
)
.refine(
  s => s.events.length === 0 || s.footer.finalTick >= s.events[s.events.length - 1].tick,
  'finalTick must be >= last event tick',
);
```

**Load-time assert 集中處**（載入 `src/engine/persistence/schema.ts` 時執行）：

- `MAX_EVENTS === 262_144`（正值、power-of-2 便於預估）
- `MAX_URL_REPLAY_BASE64 <= 8192 - 128`（URL 上限保留 128 bytes 給 origin+path+其他 param）
- `SettingsSchema.shape.cameraMode` enum 值與 `ADR-0004 §2.6` cameraMode 白名單一致（build-time cross-check）

### 2.6 安全硬規則（承 ADR-0001 §5 S8）

**F1 · 動態程式碼禁令**：

- **禁止** `eval()`、`new Function(...)`、`setTimeout(<string>, ...)`（string arg 型）
- **禁止** `import(<userInputExpr>)`：dynamic import 之參數必須為靜態字串或 build-time 已知常數；replay 讀入之任何字串不得作為 import specifier
- ESLint rule `no-eval` + `no-implied-eval` + `no-new-func` 於 CI 為 error（build-time enforcement）

**F2 · JSON 一律走 zod**：

- **禁止** `JSON.parse(raw)` 之後直接 `as unknown as X` 使用
- 任何 `JSON.parse` 之結果**必須**經 `Schema.parse(x)` 或 `Schema.safeParse(x)`
- 若 `safeParse` 失敗，falls back 至該 key 之預設值（見 §2.8 migration）；記錄至 dev console 但**不**上報 telemetry（無 telemetry 存在）

**F3 · Binary 一律走 §2.2 之 parser + checksum**：

- Replay 二進位不走 JSON；直接 `DataView` 讀 struct 欄位
- 讀完 assert checksum；不符即拒
- Base64url decode 之結果限制在 `MAX_COMPRESSED_BYTES` 之內；先檢查長度、再 decode，避免 decode 消耗記憶體

**F4 · CI 建置環境**：

- CI 不注入任何 secret / token 到靜態成品（`import.meta.env.VITE_*` 之 whitelist 於 `vite.config.ts` 集中管理）
- **允許**注入之常數僅：`__ADR_HASH__`（本 ADR §2.3）、`__BUILD_TIME__`（ISO date，供 About 頁）、`__COMMIT_SHA__`（短 hash，供 About 頁）
- **禁止**注入：任何 API key、CI token、`GITHUB_TOKEN`、`.env` 內容
- Build script 於注入前 assert whitelist；unknown env → warning + 略過

**F5 · CSP (Content Security Policy)**：

- 於 `index.html` 之 meta 加 `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; base-uri 'self'; form-action 'none'">`
- `connect-src 'none'`：明確禁止一切 outbound fetch（`fetch` / `XMLHttpRequest` / `WebSocket`）；本作為完全離線 SPA
- `style-src 'unsafe-inline'`：因 three.js / vanilla UI 初期需 inline style；後續可收緊為 nonce-based
- 於 spike phase build 時驗證 CSP 未被繞過（無 `eval`, 無 outbound；F1/F4 交叉）

**F6 · localStorage 存取層封裝**：

```ts
// src/engine/persistence/storage.ts
export function readValidated<T>(
  key: string,
  schema: z.ZodSchema<T>,
  fallback: T,
): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn(`[persistence] ${key} schema mismatch:`, result.error);
      return fallback;
    }
    return result.data;
  } catch {
    console.warn(`[persistence] ${key} JSON parse fail`);
    return fallback;
  }
}

export function writeValidated<T>(
  key: string,
  schema: z.ZodSchema<T>,
  value: T,
): boolean {
  const result = schema.safeParse(value);
  if (!result.success) return false;
  const serialized = JSON.stringify(result.data);
  if (serialized.length > 4096) return false;   // §2.1 每 key 上限
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;   // quota exceeded / privacy mode 等
  }
}
```

所有讀寫**必須**走 `readValidated` / `writeValidated`；直接呼叫 `localStorage.getItem` 於 ESLint rule `no-restricted-globals` 為 error（放行 `src/engine/persistence/storage.ts` 檔內自己使用）。

### 2.7 Replay 播放狀態重建

**設計原則**：

- Replay engine 與正常遊戲共用同一 `fsm.step(state, action, tick)` 純函式
- Replay 播放 = 逐 tick 決定當前應觸發之 GameAction，餵給 `fsm.step`，其餘與遊戲一致
- **不**錄中間 state；一切從 header.seed / header.level0 起初始化 `GameState`，逐 tick 前進至 events[N].tick

**初始化**：

```
initialState = {
  seed:           header.seed,
  level:          header.level0,
  bag:            initBagFromSeed(header.seed),      // ADR-0003 §2.4
  score:          0,
  combo:          -1,                                 // ADR-0005 §2.2
  b2bActive:      false,                              // ADR-0005 §2.4
  b2bCount:       0,                                  // ADR-0005 §2.4
  holdSlot:       null,                               // ADR-0005 §2.1
  holdUsedThisPiece: false,                           // ADR-0005 §2.1
  lastActionWasRotation: false,                       // ADR-0005 §2.3
  lastRotationUsedKick:  false,                       // ADR-0005 §2.3
  fsmState:       'SPAWN',
  ... 其他 GameState 欄位
}
```

**播放主迴圈**：

```
let state = initialState
let eventIdx = 0
for (let tick = 0; tick <= footer.finalTick; tick++) {
  const actionsThisTick: GameAction[] = []
  while (eventIdx < events.length && events[eventIdx].tick === tick) {
    actionsThisTick.push(events[eventIdx].action)
    eventIdx++
  }
  // tick order per ADR-0004 §2.3；Pause/Restart 已排除、故此處必為 §2.3 順序中 Rotation..Hold 子集
  state = fsm.step(state, actionsThisTick, tick)
  // UI overlay 顯示（純視覺、不影響 state）
  emitReplayFrame(state, tick)
}
// 結束後 assert
assert(state.score === footer.finalScore, `replay divergence at score`)
assert(state.level === footer.finalLevel, `replay divergence at level`)
assert(state.fsmState === 'GAME_OVER' || footer.outcome !== 0, `outcome mismatch`)
```

**Divergence 處理**：若 assert 失敗，代表引擎已變動但 `adrHash` 未變（bug；`adrHash` 涵蓋源錯誤）。UI 顯示「replay 已與當前引擎不相容」，記 dev console，不 crash 頁面。

**Speed 控制**：

- 正常速：1 real-tick = 1 replay-tick（16.67 ms）
- 快轉：×2, ×4, ×8 之 tick 倍率；渲染仍每 frame 一次，`fsm.step` 於 requestAnimationFrame callback 迴圈跑 N 次
- 暫停 / 拖曳進度條：直接跳 tick（因是純函式重建，無 state 洩漏）

### 2.8 Migration 政策（spike 期 minimal）

**Schema version 欄位**（於各 zod schema 之 `version: z.literal(N)`）：

- 讀入時 version mismatch → `safeParse` 失敗 → §2.6 F6 fallback 至預設值
- **不做**自動遷移：spike 期 schema 尚不穩定，各 v1 → v2 遷移邏輯負擔遠高於 fallback

**Replay schemaVersion**：

- Header §2.2 之 `schemaVersion: u16 = 1`
- 未來加欄位 → 升到 2；舊版 v1 replay 於 v2 引擎播放時 assert 失敗，UI 顯示「replay 版本過舊」
- **不做**向後兼容：spike 期玩家群 close to 0，成本效益不匹配
- Post-spike / v1.0 起始，本節重寫 (rev.2)，引入正式 migration 表

**Data loss 政策**：

- Fallback 至預設值時，**不覆寫**原 localStorage entry（等待玩家改設定時再覆寫）；避免格式演進期一次 refresh 就把舊資料抹掉
- Highscores 為例外：若 `safeParse` 失敗，記警告但保留原 entry；玩家新分數會覆寫

## 3. 已考慮的替代方案 (Alternatives Considered)

- **JSON replay stream（ADR-0004 §2.8 初版）**：可讀性高，但 event count 大時體積肥（每筆 `{tick:X,action:Y}` ≈ 24-30 bytes 未壓縮，vs 本 ADR 6 bytes）；且 JSON 無 checksum 概念，需外掛 hash。已否決；binary + gzip 是 4-5× 體積差距，值得複雜度成本
- **IndexedDB 取代 localStorage**：容量大（~數十 MiB），但 API 複雜、同步性差；本作僅設定 / 高分 / 最後一局 replay，總量 < 100 KiB，`localStorage` 5 MiB 配額綽綽有餘
- **每 tick 存 state snapshot**：replay 檔案更大、播放不需重建，但決定論之利處喪失且無法驗證 fsm 一致性；已否決
- **`adrHash` 涵蓋整個 `src/` 目錄**：更嚴格，但**任何**程式碼變動皆使舊 replay 失效（包含渲染 refactor、UI 調整），過度嚴苛。改為僅涵蓋常數-性 ADR 檔案
- **`adrHash` 使用 CRC32 或 xxhash**：計算快但碰撞率高於 sha256；碰撞 = 錯播不同版本 replay，代價高。已否決；sha256 前 16 bytes 之碰撞率 ~2^-64，足夠
- **允許 replay 跨 adrHash 播放（warning-only）**：使用者體驗較友善，但可能導致以錯誤 gravity / kick 表播放使 replay 結果詭異；已否決，嚴格 assert
- **URL query 使用短連結服務**：需 outbound API 呼叫、需 token 管理；違反 F4 CI 硬規則。已否決；長 replay 走檔案下載
- **schema migration 自動化（v1 → v2 → v3 chain）**：post-spike 才有意義；spike 期採 fallback 已足
- **CSP 完全 lockdown（含 `style-src 'self'`）**：three.js 於 build 時可能仍需 inline style；spike 期以 `'unsafe-inline'` 換效率，後續 rev.2 收緊
- **Replay 儲存於 IndexedDB blob**：`localStorage` 字串上限 5 MiB 已足 spike；IndexedDB 為 rev.2 之升級路徑
- **`adrHash` 只截 8 bytes（16 hex chars）**：碰撞率仍在 ~2^-32；為與現代 hash 慣例對齊（Git commit 短 hash 亦 8-10 hex），採 16 bytes / 32 hex（雙倍安全邊際）

## 4. 影響 (Consequences)

### 正面

- Replay 完全決定論可驗證：`fsm.step` 純函式 + seed + events → 唯一結果；出現 divergence 即 bug 訊號
- 安全邊界清楚：F1-F6 硬規則使**外部字串來源永不被執行**；即使玩家貼惡意 URL，最壞情境為「replay 拒載」
- 二進位 stream 緊湊：60 min 遊戲 ~ 400 KiB gzipped，`localStorage` / URL 皆可容納
- `adrHash` 於引擎變動時自動使舊 replay 失效，防止「錯版本播放」之靜默 bug
- CSP `connect-src 'none'`：完全離線 SPA，無 supply-chain 風險（第三方 CDN 亦禁）
- Schema fallback 策略：格式演進期玩家不會因 refresh 一次而清空設定

### 負面 / 風險

- `adrHash` 對 CRLF / 檔案編碼敏感；`.gitattributes` 若漏設可能造成跨平台 hash 不一致；隨本 ADR 一併補 `.gitattributes` 為 mandatory follow-up
- Migration 不做自動化：spike 期以 fallback 為主，玩家可能因 schema bump 一次性遺失 highscores；文件需寫明「spike 期資料非長期保留」
- Binary stream 讀寫比 JSON 難除錯：需附 `replay-inspect` CLI（build script 之附產物）以 hex dump + decoded 欄位輸出
- `MAX_EVENTS = 262_144` 之絕對上限：60 min × 60 Hz × 0.72 action/tick 假設；若玩家 fast-tapping 遠超此值，UI 需在錄影達 90% 上限時提示「replay 即將達上限」
- URL replay ≤ 6 KiB：實測需 spike 期玩家 sample 分佈；若典型 5-10 min 局面已超 6 KiB，需縮短為 5 min / 局或走檔案下載
- CSP `connect-src 'none'` 使未來若引入 leaderboard / cloud save 需 rev.2 放寬；本作定位為本地離線遊戲，此為特徵而非限制
- gzip 依賴 `CompressionStream` browser API：Chrome 80+ / FF 113+ / Safari 16.4+；FF < 113 需 polyfill 或 disable replay 分享；build target 定於 ES2022 + baseline 之瀏覽器組合，已於 ADR-0001 §2.1 略提

### 未決 / 交由 spike 驗證

- 典型 replay 大小分佈（5 min / 15 min / 60 min）→ 決定 `MAX_URL_REPLAY_BASE64` 是否需調整
- CSP `style-src` 是否可收緊為 nonce-based（需視 three.js 用法）
- `adrHash` 涵蓋清單於 ADR-0007+ 加入時之升 schemaVersion 策略
- Rebinding schema 於 gamepad rebind（ADR-0004 §2.6 未列 spike）落地時之擴充：`bindings` 陣列是否需支援 `gamepadButton: number` 欄位
- `outcome` 之後續 enum（3-255）之使用（例：`user_disconnected`, `crashed`）
- Highscores 排序 UI 於顯示側處理，非本 ADR 範圍；預設「同 level 內以 score DESC」

## 5. 後續行動 (Follow-ups)

### 隨本 ADR 一併落地（同 PR 或立即後續）

- **`.gitattributes`**：加 `docs/adr/*.md text eol=lf` + `docs/adr/*.md diff` 保證跨平台 hash 一致（§2.3 CRLF 敏感性）
- **Vite plugin `vite-plugin-adr-hash`**：build-time 計算 §2.3 之 adrHash 並注入 `import.meta.env.__ADR_HASH__`（`src/build/adr-hash-plugin.ts`）
- **ESLint config**：加 `no-eval`, `no-implied-eval`, `no-new-func` 為 error；`no-restricted-globals` 白名單化 `localStorage` 存取（§2.6 F1 F6）
- **`index.html` CSP meta**：加 §2.6 F5 之 CSP 標籤
- **`vite.config.ts` env whitelist**：明訂允許注入之常數清單（§2.6 F4）

### 實作階段 (spike phase)

- `src/engine/persistence/`：
  - `schema.ts`：本 ADR §2.5 之全部 zod schema + load-time asserts
  - `storage.ts`：§2.6 F6 之 `readValidated` / `writeValidated` 封裝
  - `replay-writer.ts`：binary encode + gzip + base64url
  - `replay-reader.ts`：base64url + gunzip + binary decode + checksum + adrHash assert
  - `replay-engine.ts`：§2.7 replay 播放狀態重建
  - `url-query.ts`：§2.4 URL param 解析 + zod 驗證
- `src/build/adr-hash-plugin.ts`：vite plugin，build-time 計算 adrHash
- 單元測試：
  - Round-trip: `write(replay) → read → assertEq(events, footer.eventCount, checksum)`
  - `adrHash` 相符 assert + 不相符 reject
  - Zod schema pass / fail cases（含超上限拒絕）
  - Fallback: `localStorage` 讀入損毀 JSON → 回傳預設值
  - Replay 播放 divergence: 手動改常數 → assert fail
  - URL query: `?seed=` valid / invalid / 上限 boundary
  - Binary layout: header + events + footer bytes 對齊、endianness、magic 檢查
- 整合測試（headless browser）：
  - CSP violation 於 `eval("1")` 呼叫時 throw
  - `fetch` 對外呼叫被 CSP 拒絕
  - `localStorage` 5 MiB quota 超出時 `writeValidated` 返 false 而不 crash

### ADR-0005 rev.3 delta（後續）

- 若 §2.7 replay 播放於實作時發現 hold slot 狀態需 tick-level 序列化（例：spawn queue 之細節），回頭修訂 ADR-0005 §2.1 之 state fields

### ADR-0007+（後續 ADR）

- **ADR-0007 條件**：Touch overlay UI 細節（ADR-0004 §2.7 之 punt）
- **ADR-0008 條件**：Leaderboard / cloud save（若日後決定引入；需 rev.2 本 ADR 之 CSP `connect-src`）
- **ADR-0009 條件**：Gamepad 完整 rebinding + polling（ADR-0004 §2.6 之後續）

### CI 硬規則檢查

- CI job `security-check`：`grep -rn "eval\|new Function" src/ --include=*.ts` 為 empty；否則 fail
- CI job `csp-check`：`grep -q "connect-src 'none'" index.html`；否則 fail
- CI job `env-whitelist`：`grep -oE "import\.meta\.env\.[A-Z_]+" src/` 之結果 subset of whitelist；否則 fail
- CI job `adr-hash-consistency`：build 兩次，assert `__ADR_HASH__` 相同（防 non-deterministic build）

## 6. 修訂紀錄 (Revision History)

### rev.1 — 2026-07-22

初稿。依 ADR-0001 rev.4 §5（S8 硬性條款）、ADR-0004 rev.2 §2.8 之推遲條款、ADR-0005 rev.2 §5 之 hold slot replay 需求，補齊：

- 儲存分層 L1 (localStorage) / L2 (URL query) / L3 (in-memory)（§2.1）
- Replay stream binary layout：32B header + var events + 40B footer；gzip + base64url（§2.2）
- `adrHash` = sha256(ADR-0001..0005 raw bytes).slice(0, 32) hex（§2.3）
- URL query state：`?replay=` / `?seed=` schema + 上限（§2.4）
- Zod schema 目錄：Rebinding / Highscores / Settings / ReplayStream 之欄位、上限、預設值（§2.5）
- 安全硬規則 F1-F6：eval 禁令、JSON zod 強制、binary checksum、CI env whitelist、CSP `connect-src 'none'`、localStorage 封裝（§2.6）
- Replay 播放狀態重建：`fsm.step` 純函式重放；divergence assert；速率 / 拖曳（§2.7）
- Migration 政策：spike 期以 fallback 為主，不做自動遷移（§2.8）
- 隨本 ADR 一併落地之 follow-ups：`.gitattributes`（CRLF 對策）、vite plugin、ESLint 規則、CSP meta、env whitelist、CI security jobs
