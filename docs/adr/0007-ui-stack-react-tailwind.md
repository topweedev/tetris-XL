---
title: ADR-0007 UI Stack — React 18 + Tailwind CSS for Menus and Screens
type: decision
status: accepted
adr_id: "0007"
repo: topweedev/tetris-XL
path: docs/adr/0007-ui-stack-react-tailwind.md
tags: [adr, tetris-xl, ui, react, tailwind, frontend, bundle-size]
---

# ADR-0007: UI Stack — React 18 + Tailwind CSS 於選單與畫面層

- 狀態：Accepted（rev.3；rev.1 為 initial draft，rev.2 承 LA8 review round-1 之 1B/6S/5N，rev.3 承 LA8 補充 round-1 之 +2S/+4N）
- 日期：2026-07-22
- 決策者：專案發起團隊
- 相關文件：
  - ADR-0001 rev.5 §2.1 / §2.5 / §5（UI 疊層條件性引入條款、three.js 3D scene、MVP vanilla 排除）
  - ADR-0004 rev.2 §2.4 / §2.7 / §2.8（keymap、觸控疊層、rebinding 設定頁）
  - ADR-0005 rev.2 §2.6（8 個 UI 邊界事件）
  - ADR-0006 rev.2 §2.5 / §2.6 F5 / §2.7（Settings/Highscores/Rebinding schema、CSP、Replay 播放 UI）

## 1. 背景 (Context)

ADR-0001 rev.5 §2.1 明訂 UI 疊層之階段性決策：

> **UI 疊層**：MVP 採 vanilla DOM overlay；若後續選單/設定膨脹再引入 React 18 + Tailwind

且 ADR-0001 §5 明確排除 React：

> 建立 `spike/` 分支製作最小可玩原型 (MVP)：只有 1-cell 與 I-tetracube，用於驗證迴圈、渲染與消除。MVP 明確**不含** React、Tailwind、音效、Gamepad、持久化。

MVP 迴圈與 three.js 渲染於 M4 完成後，UI 需求盤點（隨開發計劃 v3 M8 展開）：

| UI 元素 | 依據 ADR | 複雜度 |
|---------|---------|--------|
| HUD（分數 / level / next / combo / b2b / spin / hold slot） | ADR-0005 §2.6 8 事件 | 中 |
| Main menu（開始 / 載入 replay / 設定 / 高分榜） | 導航需求 | 中 |
| Pause overlay | ADR-0004 §2.3 Pause 機制 | 低 |
| Game over screen（final score / retry / back） | 導航需求 | 低 |
| Settings page（音量 / camera / touch / reduce-motion） | ADR-0006 §2.5 `SettingsSchema` | 中 |
| Rebinding editor（zod-validated + reset-to-default） | ADR-0004 §2.8 | 中高 |
| Highscores view（per level top-5 顯示 + 排序） | ADR-0006 §2.5 `HighscoresSchema` | 中 |
| Replay browser（list from IDB + label / pin / delete / share / download） | ADR-0006 §2.1 L1b/L1c | 高 |
| Replay share/import UI（URL query + `.txrp` 檔） | ADR-0006 §2.4 | 中 |
| Replay error toast（版本不符 / 損毀） | ADR-0006 §2.4 | 低 |
| Camera mode toggle | ADR-0006 SettingsSchema.cameraMode | 低 |
| Touch overlay（optional） | ADR-0004 §2.7 | 中 |

**盤點總計 ≥ 10 個 UI 畫面 / 元件**，vanilla DOM + 手寫 CSS 之開發成本、可維護性、可測試性、狀態管理複雜度均已超過 ADR-0001 §2.1 之「若後續選單/設定膨脹」門檻。本 ADR 觸發該條件性決策，正式引入 UI 框架。

本 ADR 補齊：

- UI 層邊界（何時走 React、何時走 three.js scene、事件橋接方向）
- 具體版本 pin 與相依樹（React 18 · Tailwind CSS + JIT）
- 狀態管理策略（no Redux / no Zustand 於 spike 期）
- Engine event bus → React 元件之訂閱橋接
- Bundle size 目標與 chunk 拆分
- CSP `style-src` 相容性（Tailwind JIT 之 build-time class extraction 避免 inline style）
- 測試框架擴充（vitest + `@testing-library/react` + `@testing-library/jest-dom`）
- 檔案結構（`src/ui/*.tsx` 與 `src/render/*.ts` 之分工）
- UI 元件清單（map 到開發計劃 v3 之 M8 phases）

## 2. 決策 (Decision)

### 2.1 UI 層邊界（React vs three.js scene）

**明確分層**：

| 層級 | 負責範圍 | 技術 | 更新頻率 |
|------|---------|------|---------|
| **Canvas 層** | 3D 井道、piece、消行動畫、camera；**canvas 元素於 `index.html` 預宣告**（不由 three.js `auto-create`），WebGLRenderer 以 `new WebGLRenderer({ canvas })` 附掛既有元素；`renderer.setSize(w, h, false)` 之第三參數 `false` 明訂**不寫入 inline style**（見 §2.7 B1）；尺寸由 Tailwind class 於 canvas 上控制 | three.js @0.160.1（ADR-0001 §2.5） | 每 frame（60 Hz） |
| **HUD overlay** | 分數浮動、combo bar、b2b bar、spin 特效、hold 預覽、debug info | React 18 元件 + Tailwind class | 事件驅動（訂閱 event bus per ADR-0001 §2.1） |
| **Menu 系統** | Main menu、pause overlay、settings、rebinding、highscores、replay browser、game over、error toast | React 18 元件 + Tailwind class | Router-driven（無 URL 路由，走 in-memory state machine） |

**邊界規則**（強制執行於 code review）：

- React 元件**不**觸發 tick 邏輯：純訂閱 engine event bus + 呼叫 `<@LA1 提供之> dispatchAction(GameAction)` API
- three.js scene**不**引用 React state：僅接受 `GameState` snapshot 與事件輸出 event bus
- HUD 之浮動分數動畫走 React（CSS transitions），**不**走 three.js sprite（避免與遊戲 3D scene 之 render order 衝突）

### 2.2 React 18

**版本**：`react@18.3.1` + `react-dom@18.3.1`（皆 exact pin，per `package.json` 規範）

**特性使用**（明訂使用範圍）：

- ✅ `useState` / `useReducer` / `useContext`：一般狀態
- ✅ `useSyncExternalStore`：訂閱 engine event bus 之穩定原語（避免 tearing；唯一 spike-baseline 之 concurrent-adjacent 原語）
- ⚠️ `useTransition` + `useDeferredValue`：**spike 期不採用**（per LA8 S8）；Highscores ≤ 100 entries、Replay browser ≤ 20 entries 之列表過濾規模不需要非阻塞更新。**Rev.2 candidate**：若 profiling 顯示 render blocking > 16 ms 才引入
- ⚠️ `Suspense`：**spike 期不採用**（per LA8 N6）；IndexedDB 讀取用 `useState` + `useEffect` 更直接；Suspense 之 UX（loading fallback）於小列表反成負擔。**Rev.2 candidate**：若之後有跨域 fetch 或大檔載入才引入
- ❌ `use()` hook：屬 React 19（截至本 ADR rev.1 尚未 stable release）；spike 期**不**採用。Rev.2 candidate 若升 React 19 再議
- ❌ Server Components：本作為純 client SPA，無 SSR
- ❌ `renderToString` / hydration：無 SSR
- ❌ `React.lazy` + code-split：spike 期單 bundle；rev.2 可能引入（S4 vendor chunk 過大時之解決路徑）

**Root 掛載**：

```tsx
// src/ui/main.tsx
import { createRoot } from 'react-dom/client';
import { UIRoot } from './UIRoot';
import { EngineBridge } from './bridge/EngineBridge';

const container = document.getElementById('ui-root');
if (container === null) throw new Error('#ui-root not found');
createRoot(container).render(<UIRoot bridge={EngineBridge.instance} />);
```

`index.html` 需新增 `<div id="ui-root">`（於既有 `<div id="app">` 內；`#app` 承載 three.js canvas、`#ui-root` 疊於其上）。

### 2.3 Tailwind CSS + JIT

**版本**：`tailwindcss@3.4.15`（3.x latest；4.x alpha 不採用因 API 未穩）

**Vite integration**：`@tailwindcss/vite@0.0.1` 之 3.x compatibility mode，或以 `postcss` + `autoprefixer` 之標準路徑。**採後者**（更穩定；`postcss.config.js` + `tailwind.config.ts`）：

```
package.json 追加：
- tailwindcss@3.4.15
- postcss@8.4.49
- autoprefixer@10.4.20
- @tailwindcss/forms@0.5.9    (settings 表單元件；optional)
```

**JIT 模式**：Tailwind 3.x 預設 JIT。Build 時掃描 `src/ui/**/*.{tsx,ts}` 與 `index.html`，僅產出實際使用之 utility class → CSS。預期 bundle 大小 ≤ 15 KiB gzip（typical Tailwind SPA payload）。

**動態 class name 之硬性禁令（S3 fix）**：

JIT 之 class extraction 走 static analysis（字面 pattern scan），**無法**捕捉 runtime 拼裝之 class name：

```tsx
// ❌ 禁止 —— JIT 抓不到 text-lg / text-xl；build 出來的 CSS 遺失
const size = 'lg';
<div className={`text-${size}`} />

// ✅ 正確 —— 全 candidate 皆為字面，JIT 掃得到
const sizeClass = size === 'lg' ? 'text-lg' : 'text-xl';
<div className={sizeClass} />

// ✅ 正確 —— 或使用 clsx / cn helper
<div className={clsx('text-base', variant === 'primary' && 'text-blue-500')} />
```

規則於 code review 執行（ESLint 之 template-literal-in-className 檢查於 `eslint.config.js` 開啟；CI grep guardrail 亦補 per §5）。若真需 runtime 產出之 class，於 `tailwind.config.ts` 之 `safelist` 明列（並於 PR body 記錄理由）。

**Config**（`tailwind.config.ts`）：

```ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/ui/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'well-bg':     '#0a0e1a',
        'well-border': '#2b3a5a',
        'piece-highlight': '#7dd3fc',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  safelist: [
    // 若有動態 class 需求，明列於此；預設為空以強迫靜態化
  ],
  plugins: [
    // '@tailwindcss/forms' 於 P8.5 Settings / P8.6 Rebinding editor 落地時決議
    // 引入成本：~5 KiB gzip；優點：<input>/<select>/<textarea> 預設樣式一致化
    // 決策時機：M8 P8.5 動工前；於該 PR body 記錄「是否引入 + 預估 bundle 影響」
    // 於本 ADR 落地時**先不引入**，保持選擇彈性
  ],
} satisfies Config;
```

**PostCSS config**（`postcss.config.mjs`；因 `package.json` 為 `"type": "module"`，用 `.mjs` 副檔名避免 CommonJS interop）：

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Global CSS**（`src/ui/index.css`）：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Reduce-motion 支援**（N2 fix：改走 Tailwind `motion-reduce:` variant，而非全域 `!important` hack）：

於各動畫元件明訂降級路徑，例：

```tsx
// ✅ Tailwind motion-reduce: variant（推薦）
<div className="transition-transform duration-300 motion-reduce:transition-none motion-reduce:duration-0" />

// ❌ 不採 —— 全域 * !important 覆蓋難維護且會 override 開發者刻意保留之動畫
```

Tailwind 之 `motion-reduce:` 對映 `@media (prefers-reduced-motion: reduce)`，per-元件細粒度控制。若某動畫故意保留（例：`piece lock` 短暫閃爍為可讀性核心），該元件不加 `motion-reduce:`。

**於 `src/ui/main.tsx` 引入**：`import './index.css';`

### 2.4 狀態管理策略

**Spike 期原則**：**no Redux / no Zustand / no MobX**。分兩層：

1. **Engine state**（`GameState`）：由 fsm.step 純函式管理；React 透過 `useSyncExternalStore` 訂閱 event bus 拿到最新 snapshot（read-only）
2. **UI-only state**（Menu 導航、Settings 未儲存值、Rebinding 編輯中）：`useState` / `useReducer` 於元件內；跨元件透過 `useContext` 傳遞

**理由**：

- 本作單 client、無多 tab 同步、無 URL routing、無 SSR → 全域 store 之複雜度不划算
- Engine state 已有唯一 source of truth（fsm.step）→ 再引 Redux 反而製造 sync bug 面
- UI-only state 之作用域小（單一畫面內）→ useState 足矣

**Rev.2 可能引入**：若 Settings 頁膨脹或跨 route sharing 增加 → 引 Zustand（<1 KiB gzip，minimal API）；不引 Redux（overkill）。

### 2.5 Engine event bus 橋接（`useSyncExternalStore`）

**橋接元件**（`src/ui/bridge/EngineBridge.ts`）：

```ts
import { getEngineBus, type EngineEvent } from '@engine/events/bus';

type Subscriber = () => void;

export class EngineBridge {
  private static _instance: EngineBridge | null = null;
  static get instance(): EngineBridge {
    if (this._instance === null) this._instance = new EngineBridge();
    return this._instance;
  }
  /** Test-only reset：清 subscribers + snapshot；用於 vitest `afterEach` */
  static resetForTest(): void {
    if (this._instance !== null) this._instance.dispose();
    this._instance = null;
  }

  private subscribers = new Set<Subscriber>();
  private snapshot: GameStateSnapshot = getInitialSnapshot();
  private busUnsubscribe: (() => void) | null = null;

  private constructor() {
    // Lazy 訂閱：於 constructor 內 attach；在 test 中透過 resetForTest() 卸載
    this.busUnsubscribe = getEngineBus().on('*', (event: EngineEvent) => {
      const next = this.applyEvent(this.snapshot, event);
      // ★ 不可變合約：只有欄位真變化時才 return 新 reference；
      //   否則保持既有 snapshot（避免 useSyncExternalStore 誤認為 dirty 而重繪）
      if (next !== this.snapshot) {
        this.snapshot = next;
        this.subscribers.forEach(fn => fn());
      }
    });
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  getSnapshot(): GameStateSnapshot { return this.snapshot; }
  dispatchAction(action: GameAction): void { getEngineBus().dispatch(action); }

  private dispose(): void {
    this.busUnsubscribe?.();
    this.subscribers.clear();
  }

  private applyEvent(prev: GameStateSnapshot, event: EngineEvent): GameStateSnapshot {
    // 只更新受影響欄位；若欄位無變化 return prev（reference 相等 = React skip render）
    // ...
    return next;
  }
}

// Hook：
import { useSyncExternalStore } from 'react';
export function useEngineSnapshot(): GameStateSnapshot {
  return useSyncExternalStore(
    EngineBridge.instance.subscribe.bind(EngineBridge.instance),
    EngineBridge.instance.getSnapshot.bind(EngineBridge.instance),
  );
}
```

**強制契約（memoization / immutability）**：

- Bridge 之 `snapshot` **必須**於欄位無變化時保持 reference 相等（`getSnapshot` 之連續兩次呼叫若欄位皆同 → 回傳同一 object）
- `applyEvent` 只 return 新 object 當且僅當實際欄位變動；未變 return `prev`（早 return path）
- React 之 `useSyncExternalStore` 依 reference 相等偵測是否 dirty；若違反此契約，會於高頻事件下（每 tick emit）觸發 render thrashing → 60 fps 掉幀
- 於 vitest 加測試：`emit no-op event × 100` → `getSnapshot()` 回傳同一 reference（`Object.is` assert）

**Test-time 隔離**：

- 每個 test 之 `afterEach` 呼叫 `EngineBridge.resetForTest()`，避免 singleton state 跨 test 洩漏
- `vitest.config.ts` 之 `globalSetup` 可注入 helper；於 `tests/setup.ts` 補：
  ```ts
  import { afterEach } from 'vitest';
  import { EngineBridge } from '@ui/bridge/EngineBridge';
  afterEach(() => { EngineBridge.resetForTest(); });
  ```

**規則**：

- Bridge 之 snapshot 為**不可變**（見上契約）
- Bridge 只讀 event bus；**不**寫入 fsm state
- React 之「按開始遊戲」按鈕 → `bridge.dispatchAction(GameAction.Start)` → engine consumes；不直接改 `GameState`
- Selector hooks（例：`useCombo()` 只訂閱 `snapshot.combo`）之 subset 訂閱由 memoized wrapper 提供（rev.2 若有頻繁 render 觸發時再引入）

### 2.6 Bundle size 目標與 chunk 拆分

**目標**（於 M4 MVP 加 M8 完成後之 `pnpm build` 產出）：

| Chunk | 內容 | 目標大小（gzip） | 備註 |
|-------|------|------------------|------|
| `index.js`（entry） | React root + Menu 系統 + Engine bridge | ≤ **80 KiB** | |
| `vendor.js`（split） | react + react-dom + three | ≤ **160 KiB** | three.js @0.160 minimal build ~100 KiB gzip；react+react-dom ~45 KiB；預留 15 KiB 緩衝（**上調自 rev.1 之 120 KiB**，per S4 review） |
| `game.js`（split，optional） | engine core + persistence | ≤ **60 KiB** | |
| `styles.css` | Tailwind JIT 輸出 | ≤ **15 KiB** | |
| **總計初次載入** | | ≤ **315 KiB** gzip | |

**Chunk 拆分策略**（`vite.config.ts` 之 `manualChunks`）：

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'three'],
        game:   ['./src/engine'],
      },
    },
  },
}
```

**若實測 vendor > 160 KiB 之升級路徑**：

1. 拆 three 為獨立 chunk（`three.js` chunk），react + react-dom 於 `vendor` chunk
2. 或啟用 `React.lazy` 對 Menu 系統做 route-level code split（本 ADR §2.2 之「rev.2 candidate」）
3. Tree-shake 檢查：確認 three.js 未 import 未用之 loader（例：`SVGLoader`, `GLTFLoader` 於本作不需）

**Guardrail**（N3 fix：明訂為**相對於目標之 20% 上限**）：

- 於 CI 加 `bundle-size` job（可用 `bundlesize` npm 或手寫 script）
- Fail 條件：任一 chunk 之 gzip 大小 > `target × 1.20`（例：vendor 目標 160 KiB → 硬拒 > 192 KiB）
- Warn 條件：> `target × 1.10`（PR comment 提示，不 fail）
- 首次落地時 baseline 於 P8.1 之 PR 記錄；後續 phase 之 PR body 需標 diff（`+X KiB / -Y KiB vs baseline`）

### 2.7 CSP `style-src 'self'` 相容性（B1 fix：含 three.js 整合硬性規則）

**問題**：ADR-0006 §2.6 F5 現況允許 `style-src 'self' 'unsafe-inline'`（spike 期）；rev.2 target 原訂為 nonce-based。本 ADR 使 `'self'`（**無 `'unsafe-inline'`、亦無 nonce**）成為可行路徑，前提是所有 inline style 之來源皆被消除。

**Tailwind 之影響**：

- Tailwind JIT **build-time** 產出靜態 CSS 檔（`dist/styles.css`）→ 走 `<link rel="stylesheet">` → CSP `style-src 'self'` 即可載入，**無需 unsafe-inline**
- React 之 `style={...}` inline prop **會**產生 inline style → 需 unsafe-inline 或 nonce
- Tailwind class-based 寫法（`className="text-lg font-bold"`）**不**產生 inline style，僅套用預先 build 出來的 class → CSP-friendly

**規則 · React 側**（強制執行）：

- React 元件**禁止** `style={...}` prop；一律用 Tailwind class
- 動態 style（例：progress bar 之 `width`）走 Tailwind `w-[<value>]` arbitrary value（build 時已由 JIT 掃出）
- ESLint rule 加 `no-restricted-syntax` 攔截 JSX `style={...}` attribute（見 §5 CI）

**規則 · three.js 側（B1 fix；核心）**：

three.js `WebGLRenderer` 之預設行為會產生 inline style；若不強制關閉將於 `style-src 'self'` 環境被 CSP 阻擋：

1. **Canvas 元素於 `index.html` 預宣告**，避免 `WebGLRenderer` auto-create 之 canvas 帶 `style.display='block'`：

   ```html
   <!-- index.html -->
   <body>
     <div id="app">
       <canvas id="game-canvas" class="fixed inset-0 w-full h-full"></canvas>
       <div id="ui-root"></div>
     </div>
   </body>
   ```

2. **WebGLRenderer 附掛既有 canvas**（不 auto-create）：

   ```ts
   // src/render/scene.ts
   const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
   if (canvas === null) throw new Error('#game-canvas not found in index.html');
   const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
   ```

3. **`renderer.setSize(w, h, false)` 之第三參數必為 `false`**：

   ```ts
   // ❌ 禁止 —— 預設 updateStyle=true 會寫 canvas.style.width/height 之 inline style
   renderer.setSize(width, height);
   renderer.setSize(width, height, true);

   // ✅ 正確 —— updateStyle=false 只設 canvas.width/height 屬性（非 style）
   renderer.setSize(width, height, false);
   ```

   Canvas 之視覺尺寸由 Tailwind class（`w-full h-full` + parent layout）決定；three.js 只管內部 render buffer 之像素尺寸。

4. **其他 three.js 路徑之 inline style 來源檢查**：

   本作**不使用**以下已知會產生 inline style 之 three.js 元素（即使未來要用亦需另行審視 CSP 影響）：

   - `SVGLoader` / `SVGRenderer`（會於 DOM 產生 `<style>` block）
   - `CSS2DRenderer` / `CSS3DRenderer`（產生 inline positioning）
   - `EffectComposer` 之部分 post-processing pass（若有）

   於 §5 加 CI grep guardrail 攔截誤用。

5. **Sizing 責任分工**：

   - CSS 控制 canvas 之視覺尺寸（`w-full h-full` + parent flex/grid layout）
   - `renderer.setSize(canvas.clientWidth * dpr, canvas.clientHeight * dpr, false)` 於 `ResizeObserver` callback 內同步 render buffer；`dpr = Math.min(window.devicePixelRatio, 2)` 節省 memory
   - Camera aspect ratio 於 resize 時亦更新：`camera.aspect = clientW / clientH; camera.updateProjectionMatrix();`

**與 ADR-0006 之關係（S5 fix；cross-ref 對齊）**：

- **ADR-0006 rev.2 §2.6 F5** 現況：`style-src 'self' 'unsafe-inline'`；標註 rev.2 target 為「nonce-based」
- **本 ADR-0007** 使 `'self'`（無 `'unsafe-inline'`、**亦無 nonce**）成為可行路徑，條件是遵守本 §2.7 React 側 + three.js 側規則
- **後續 ADR-0006 rev.3**：將 §2.6 F5 之 rev.2 target 由「nonce-based」**改為 `style-src 'self'`**（更嚴格 + 更簡單 + 無需 build-time nonce 生成 plumbing）
- ADR-0006 rev.3 之落地 timing：**與本 ADR-0007 之 CI CSP tightening 同一 PR 或緊隨其後**（否則 index.html 之 CSP meta 會臨時降級或緊耦合 vite 之 nonce 注入邏輯）

**目標**：本 ADR + ADR-0006 rev.3 落地後，CSP 之 `style-src` **收緊為 `'self'`**（drop `'unsafe-inline'`；不引入 nonce plumbing）。此為 ADR-0006 §2.6 F5 rev.2 target 之提前 + 簡化實現。

### 2.8 Test 框架擴充

**新增 dev deps**：

```
@testing-library/react@16.1.0
@testing-library/jest-dom@6.6.3
@testing-library/user-event@14.5.2
jsdom@25.0.1（vitest 之 dom env；若已裝可略）
```

**Vitest 設定**（`vitest.config.ts` 更新；N1 fix：jsdom 僅對 `src/ui/**` tests 啟用，engine tests 保留於 node 環境以節省啟動成本 + 避免 DOM 副作用）：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    environmentMatchGlobs: [
      ['tests/ui/**',    'jsdom'],   // React component tests
      ['tests/**',       'node'],    // Engine tests keep node env (faster + no DOM)
    ],
  },
});
```

**`tests/setup.ts`**：

```ts
import '@testing-library/jest-dom/vitest';
```

**測試型別**：

- Component unit tests：render + fireEvent + assertions
- Integration tests：EngineBridge stub + component 訂閱 event 之更新驗證
- Snapshot tests：**不採用**（易腐、review overhead 高）
- Visual regression：spike 期不採；rev.2 若需引入 Playwright + `playwright-visual-comparison`

**覆蓋率目標**：UI 元件 ≥ 70% branch（相較 engine 之 100% 較寬鬆；因 render 邏輯多屬結構性）

### 2.9 檔案結構

```
src/
  engine/               ← 純函式 game engine（不動；per ADR-0001 §2.8）
  render/               ← three.js canvas + scene 管理（不動）
  ui/                   ← NEW · React + Tailwind UI 層
    main.tsx            ← React root 掛載 + import './index.css'
    index.css           ← @tailwind directives
    UIRoot.tsx          ← 頂層 router state machine
    bridge/
      EngineBridge.ts   ← engine event bus ↔ React 訂閱橋接
      useEngineSnapshot.ts
      useDispatchAction.ts
    screens/            ← 全屏 / 半屏面板
      MainMenu.tsx
      PauseOverlay.tsx
      GameOverScreen.tsx
      SettingsPage.tsx
      RebindingEditor.tsx
      HighscoresView.tsx
      ReplayBrowser.tsx
      ReplayShareModal.tsx
      ReplayErrorToast.tsx
    components/         ← 共用元件（含 HUD 疊層 · per N7）
      Button.tsx
      Modal.tsx
      Toast.tsx
      NumericInput.tsx
      KeyCapture.tsx    ← Rebinding editor 之單鍵擷取
      CameraModeToggle.tsx
      hud/              ← 遊戲進行中之疊層元件（於 components/ 內作為 subgroup，per N7 fold）
        HUDRoot.tsx
        ScoreFloat.tsx
        ComboIndicator.tsx
        B2BBar.tsx
        SpinEffect.tsx
        HoldSlotPreview.tsx
tailwind.config.ts      ← NEW
postcss.config.mjs      ← NEW
```

**理由（N7 fold）**：`hud/` 於 rev.1 為 top-level dir，spike 期 4 top-level dir 深度可簡化。HUD 元件本質為「可重用之遊戲內疊層 widget」→ 語意上與 `components/` 之 reusable UI 一致，遂 fold 為 `components/hud/`。Screens vs components 之邊界依 「is-a full panel」判定：screen 佔滿或半屏；component 為 widget-level。

**規則**：

- `src/ui/` 之檔案**不得** import `src/render/` （單向依賴：`ui/` → `bridge/` ← `engine/`）
- `src/render/` 之檔案**不得** import `src/ui/` （純 canvas 層）
- `src/engine/` 保持零外部依賴（除 zod / idb per ADR-0006 §5）

ESLint rule（新增於 `eslint.config.js`）：

```js
// render/ 不得 import ui/
{
  files: ['src/render/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/ui/**'],
        message: 'render/ must not import ui/ (canvas layer is pure)',
      }],
    }],
  },
},

// ui/ 不得 import render/；且 ui/{screens,hud,components}/ 亦不得直接 import engine/
// —— 只允許 ui/bridge/** 作為 engine <-> ui 之唯一橋接點（S2 fix）
{
  files: ['src/ui/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/render/**'],
        message: 'ui/ must not import render/ (use engine event bus via bridge)',
      }],
    }],
  },
},
{
  files: [
    'src/ui/screens/**/*.{ts,tsx}',
    'src/ui/components/**/*.{ts,tsx}',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/engine/**', '@engine/**'],
        message: 'ui/screens|components must go through ui/bridge/* (not engine/ directly)',
      }],
    }],
  },
},
```

**理由**：`src/ui/bridge/` 為 UI ↔ engine 之單一橋接點；直接 import `src/engine/**` 會繞過 `EngineBridge` 之訂閱 / snapshot 語意，造成 tearing 或 event 遺漏。允許 bridge 內部 import `@engine/events/bus` 與 `@engine/types/state`；其他 UI 子目錄禁止。

### 2.10 UI 元件清單 · 對映開發計劃 v3 M8 phases

| Phase | 元件 | 依賴 ADR § |
|-------|------|------------|
| **P8.1** HUD | `components/hud/{HUDRoot, ScoreFloat, ComboIndicator, B2BBar, SpinEffect, HoldSlotPreview}` | ADR-0005 §2.6 全 8 事件 |
| **P8.2** Main menu | `screens/MainMenu` | 導航需求 |
| **P8.3** Pause overlay | `screens/PauseOverlay` | ADR-0004 §2.3 Pause |
| **P8.4** Game over | `screens/GameOverScreen` | 導航需求 |
| **P8.5** Settings page | `screens/SettingsPage` + `components/CameraModeToggle` | ADR-0006 §2.5 `SettingsSchema` |
| **P8.6** Rebinding editor | `screens/RebindingEditor` + `components/KeyCapture` | ADR-0004 §2.8 |
| **P8.7** Highscores view | `screens/HighscoresView` | ADR-0006 §2.5 `HighscoresSchema` |
| **P8.8** Replay browser | `screens/ReplayBrowser` + `screens/ReplayShareModal` | ADR-0006 §2.1 L1b/L1c |
| **P8.9** Replay share/import | `screens/ReplayShareModal` + `screens/ReplayErrorToast` | ADR-0006 §2.4 |
| **P8.10** Touch overlay [optional] | 走 `src/render/` 之 touch canvas 疊層，**非** React（因需與 canvas 同座標系） | ADR-0004 §2.7 |

## 3. 已考慮的替代方案 (Alternatives Considered)

**主要對比軸**（5 個關鍵替代 · N8 fix：其餘 7 個併入本節末尾之「Also considered」附錄）：

- **維持 Vanilla DOM + 手寫 CSS**：無新相依樹，最小 bundle。但 10 個畫面 × 平均 200 LOC + CSS = ~2500 LOC 手寫，狀態管理易 spaghetti，元件無法 unit test（需 Playwright DOM diffing 才能驗證）。已否決；ADR-0001 §2.1 之「後續選單膨脹再引入」門檻已達
- **Preact @10.x + Tailwind**：React API 相容、bundle 極小（~4 KiB gzip vs React 18 ~45 KiB）。但 `@testing-library/react` 需 `preact/compat` shim；React 18 concurrent 特性（`useSyncExternalStore` 之穩定 tearing 防護）需額外相容層。已否決；本作非 mobile-first / bandwidth-critical，React 之生態更成熟
- **Solid.js**：無 VDOM，效能極佳，bundle 小。但 API 陌生（signals 語意學習曲線）、testing 生態較弱、與 three.js 之整合案例少於 React。已否決；spike 期不冒學習曲線風險
- **CSS-in-JS（styled-components / emotion）**：runtime style 產出、React 元件內共存。但**與 CSP `style-src 'self'` 不相容**（會產生 inline `<style>` tags 需 unsafe-inline）；且 runtime 開銷 ~20 KiB。已否決；違反本 ADR §2.7 之安全目標
- **引入 Zustand / Jotai / Redux Toolkit 全域 store**：跨畫面狀態統一。本作 UI-only state 作用域小、engine state 已有 fsm.step 唯一 source → 全域 store overkill。已否決；rev.2 若 Settings 頁膨脹再議

**Also considered（N8 fix：附錄，一句總結）**：

- **Svelte 5**：`.svelte` 檔 mixed toolchain complexity；rune API 新未穩定 → 否決
- **Vue 3 + `<script setup>`**：template DSL 對 TS type-inference 弱於 JSX；three.js 整合案例少 → 否決
- **LitElement + Web Components**：shadow DOM 與 Tailwind JIT global stylesheet 假設衝突 → 否決
- **UnoCSS 取代 Tailwind**：更快 JIT / smaller bundle，但 preset 生態不及 Tailwind；`@tailwindcss/forms` 等價需自維 → 否決
- **CSS Modules**：無 utility class 快速 prototyping 效率；每元件需 `.module.css` → spike velocity 不划算，否決
- **React 19（beta / rc）**：`use()` hook 與 Actions API 更成熟，但截至 2026-07 尚未 stable + testing lib 相容性未證實 → **Rev.2 candidate**
- **Tailwind 4.x（alpha）**：CSS-first config、Rust engine 更快，但 API 未穩定 + plugin 相容性未證實 → 否決，鎖 3.4.x

## 4. 影響 (Consequences)

### 正面

- 10+ UI 畫面之開發速度大幅提升（宣告式 JSX + utility class）
- React 18 concurrent 特性使 Highscores / Replay browser 之長列表過濾流暢
- Tailwind JIT build-time class extraction → CSP `style-src 'self'` 可立即收緊（提前實現 ADR-0006 rev.2 target）
- `useSyncExternalStore` 橋接 engine event bus 之穩定原語，避免 tearing 與 stale closure
- `@testing-library/react` 使 UI 元件可 unit test，覆蓋率提升
- ESLint no-restricted-imports 強制 `ui/` ↔ `render/` 單向依賴

### 負面 / 風險

- Bundle size 增加：vendor chunk 加 react + react-dom ~45 KiB gzip
- 新相依樹：react / react-dom / tailwindcss / postcss / autoprefixer / @testing-library/* → 需 pnpm lock 完整管理
- React 18 之 supply-chain 攻擊面（雖成熟；per ADR-0006 §2.6 F1-F6 之 CSP + no-eval 已抗）
- 新學習曲線：LA2 / LA5 若未熟 React 18 concurrent hooks，需查文件；rev.N 可能觸發
- CSP `style-src 'self'` 收緊後，若 code review 未擋 inline `style={...}`，會於 production 觸發 CSP 違規 → 需 ESLint rule 額外檢查（本 ADR §2.7 之強制規則）
- `useSyncExternalStore` 之 `getSnapshot` 於高頻事件下若 return 新 object 會導致 render thrashing；`EngineBridge` 之 snapshot 必須 memoize（於實作階段強制）
- Tailwind JIT 掃描 `src/ui/**/*.{ts,tsx}` → 若 class name 動態組合（`className={\`text-${size}\`}`）JIT 抓不到，class 遺失於 build。需以 explicit safelist 或避免動態組合（於 code review 檔）
- Touch overlay 於 P8.10 保留於 `src/render/`（非 React）→ 可能造成 UI layer 與 canvas layer 之邊界不對齊；rev.2 target 若 touch UX 穩定，考慮遷入 `src/ui/`

### 未決 / 交由 spike 驗證

- Bundle chunk 拆分策略（`manualChunks`）於實測後可能需調整（例：react-dom 若 tree-shaking 不佳，可能拆更細）
- 是否引入 `@tailwindcss/forms` plugin：Settings / Rebinding 頁若表單元素多可引入（~5 KiB gzip）
- Bundle size CI guardrail 之具體工具（`bundlesize` vs 手寫 script）
- Reduce-motion 於 React 動畫之整合：本 ADR 於 `index.css` 之 `@media (prefers-reduced-motion: reduce)` 是全域 hack；rev.2 可能需 per-元件細粒度控制
- Router 是否採用 in-memory state machine（本 ADR 建議）vs `react-router@6`（多 5 KiB gzip）：spike 期原則採前者，rev.2 若需支援 URL deep link 再議

## 5. 後續行動 (Follow-ups)

### 隨本 ADR 落地（M8 之先，或 M8 P8.1 之前置）

- **`package.json`** 新增：react@18.3.1 / react-dom@18.3.1 / @types/react / @types/react-dom / tailwindcss@3.4.15 / postcss@8.4.49 / autoprefixer@10.4.20 / @testing-library/react@16.1.0 / @testing-library/jest-dom@6.6.3 / @testing-library/user-event@14.5.2
- **`tailwind.config.ts`**、**`postcss.config.mjs`** 新建（N5：因 `package.json` 為 `"type": "module"`，PostCSS config 用 `.mjs`）
- **`src/ui/main.tsx`**、**`src/ui/UIRoot.tsx`**（skeleton）、**`src/ui/index.css`** 新建
- **`src/ui/bridge/EngineBridge.ts`** + `useEngineSnapshot.ts` + `useDispatchAction.ts`
- **`index.html`** 加 `<div id="ui-root">` + `<link rel="stylesheet" href="/dist/styles.css">`（vite 自動注入）
- **`eslint.config.js`** 新增 `no-restricted-imports` for `ui/` ↔ `render/` 邊界
- **`vitest.config.ts`** 之 environment 改為 jsdom；`tests/setup.ts` 加 `@testing-library/jest-dom` 匯入
- **`vite.config.ts`** `manualChunks` 加 vendor / game split
- **CI 加 bundle-size job**（本 ADR §2.6 之 guardrail）

### 影響既有 ADR

- **ADR-0001 rev.6 candidate**：§2.1 之「MVP 採 vanilla DOM overlay；若後續選單/設定膨脹再引入 React 18 + Tailwind」之後半條件已於本 ADR 落地；rev.6 補述「條件已觸發，per ADR-0007」
- **ADR-0006 rev.3 candidate**：§2.6 F5 之 `style-src 'self' 'unsafe-inline'` 收緊為 **`style-src 'self'`**（drop `'unsafe-inline'`；**不引入 nonce plumbing**；因 Tailwind JIT + 本 ADR §2.7 之 React/three.js 硬規則使 nonce 非必要）。原 rev.2 target「nonce-based」由此 rev.3 取代為更簡單/更嚴格之 `'self'`-only。落地 timing：**與本 ADR-0007 之 CI CSP tightening 同一 PR 或緊隨其後**（否則 index.html CSP meta 會臨時失一致性）。

### 實作階段（M8）

- 依開發計劃 v3 M8 之 P8.1-P8.10 順序執行；每 phase 之 UI 元件於本 ADR §2.10 表已列
- Bridge 之 memoization 落實：`snapshot` 之 subset selector（例：`useCombo()` 只訂閱 combo 欄位）
- Storybook（optional）：若元件展示需求出現，rev.2 candidate

### CI 硬規則檢查

- `bundle-size` job：於 PR 加 `pnpm build --report` 之 dist 大小 diff comment；fail 條件為任一 chunk 之 gzip 大小 > `target × 1.20`（warn > × 1.10；見 §2.6 N3 clarification）
- `three-inline-style-check`（B1 fix）：於 `src/render/**/*.ts` grep 以下 anti-patterns → 命中則 fail
  - `new WebGLRenderer\(\s*\)`（無參 auto-create canvas）
  - `renderer\.setSize\([^,)]+,[^,)]+\)` 或 `renderer\.setSize\([^,]+,[^,]+,\s*true\)`（缺第三參數 or 明寫 `true`）
  - `SVGLoader` / `SVGRenderer` / `CSS2DRenderer` / `CSS3DRenderer` 之 import
- **`supply-chain-audit`（S7 fix；新增）**：`pnpm audit --prod --audit-level=high || exit 1` + `osv-scanner --lockfile pnpm-lock.yaml`；CI 命中高危 CVE 即 fail。首次落地時 baseline 記錄於 P8.1 之 PR
- `tailwind-dynamic-class-grep`（S3 fix）：於 `src/ui/**/*.tsx` grep `className={\`[^}]*\${` template-literal 動態組合 → 命中則 warn（若真需 safelist 於 tailwind.config.ts）

**移除 rev.2 曾提之 CI job（N9 fix；避免重複）**：

- ~~`css-purge-check`~~：與 Tailwind JIT 之 build-time content scan 重複，drop（Tailwind JIT 已保證只輸出 used class）
- ~~`csp-inline-style-grep` 之獨立 CI job~~：改為 **ESLint rule** `no-restricted-syntax`（於 `eslint.config.js` 內），於 `pnpm lint` 階段捕捉，不需另設 CI job

  ```js
  // eslint.config.js（併入既有 ui/ files rule）
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'JSXAttribute[name.name="style"]',
        message: 'inline style={} prohibited (ADR-0007 §2.7); use Tailwind class instead',
      }],
    },
  },
  ```

## 6. 修訂紀錄 (Revision History)

### rev.3 — 2026-07-22

依 LA8 補充 round-1 review 修訂（brain：`oab/pr/11`；expanded verdict：NEEDS_CHANGES，1B/8S/7N；rev.2 已解 1B/6S/5N，本 rev.3 解剩下 +2S/+4N）：

- **S7 (Supply-chain) → §5 CI**：新增 `supply-chain-audit` job（`pnpm audit --prod --audit-level=high` + `osv-scanner --lockfile pnpm-lock.yaml`）；exact pin 不保證無 CVE，需 CI 主動檢
- **S8 (§2.2 concurrent hooks over-engineering)**：`useTransition` + `useDeferredValue` 從 rev.2 之 `✅ 使用範圍` 降級為 **spike 期不採用（Rev.2 candidate）**。理由：Highscores ≤ 100 entries + Replay browser ≤ 20 entries 之列表規模不需要非阻塞更新；spike 期用 `useState` 起步，profiling 顯示 render blocking > 16 ms 才引入
- **N6 (§2.2 Suspense over-engineering)**：`Suspense` 從 rev.2 之 `✅` 降級為 **spike 期不採用（Rev.2 candidate）**。理由：IndexedDB 讀取小列表用 `useState` + `useEffect` 更直接；Suspense 之 fallback UX 於小列表反成負擔
- **N7 (§2.9 dir 深度簡化)**：`src/ui/hud/` 從 top-level dir fold 為 `src/ui/components/hud/` subgroup。理由：HUD 元件本質為「可重用之遊戲內疊層 widget」，與 `components/` 之語意一致；top-level dir 由 4 減為 3 (`bridge/`, `screens/`, `components/`)。§2.10 之元件路徑亦同步更新（`HUDRoot` 等歸於 `components/hud/*`）。ESLint rule 相應更新（移除 `hud/` glob，僅列 `screens/**` + `components/**`）
- **N8 (§3 alternatives trim)**：12 個替代方案 → 保留 5 個關鍵對比軸（Vanilla / Preact / Solid / CSS-in-JS / Zustand），其餘 7 個（Svelte / Vue / LitElement / UnoCSS / CSS Modules / React 19 / Tailwind 4）移至「Also considered」附錄，每項一句總結
- **N9 (§5 CI job consolidation)**：
  - Drop `css-purge-check`：與 Tailwind JIT 之 build-time content scan 重複
  - `csp-inline-style-grep` 從獨立 CI job 改為 **ESLint `no-restricted-syntax` rule**（於 `pnpm lint` 階段捕捉；`JSXAttribute[name.name="style"]` selector 攔截 inline style prop）
  - CI job list 從 rev.2 之 5 個減為 **4 個**（bundle-size / three-inline-style-check / supply-chain-audit / tailwind-dynamic-class-grep）

**LA8 補充 round-1 之「與既有 ADR 核對 / 安全總評」全數確認**：
- ADR-0001 rev.5 §2.1 條件觸發一致；與 §5 (MVP 排除 React) 無矛盾，因本 ADR 屬 M8 後續階段
- ADR-0004 rev.2 §2.7 touch overlay 保留於 `render/`（非 React）是 spike 期合理簡化
- ADR-0005 rev.2 §2.6 之 8 事件與 HUD 元件對應清楚
- ADR-0006 §2.6 F5 之 CSP 收緊路徑經 B1 修正後確認可行
- ADR-0006 §2.3 adrHash 涵蓋範圍：本 ADR (UI stack) 亦排除，與 ADR-0006 自身排除同理由（不影響 replay determinism）

**status**：Accepted（rev.3 為 LA8 補充 round-1 之全數落實；rev.4+ 若有 code impl 期發現再議）

### rev.2 — 2026-07-22

依 LA8 round-1 review 修訂（brain：`oab/pr/11`；verdict：NEEDS_CHANGES → 本 rev 全部落實 → 進入 Accepted）：

- **B1 (Blocking) → §2.1 / §2.7 / §5 CI**：three.js `WebGLRenderer` 之預設行為（auto-create canvas 之 `style.display='block'`；`setSize(w,h,true)` 寫入 inline `width/height`）會破壞 `style-src 'self'`。修正：
  - §2.1 Canvas 層描述加註「canvas 於 `index.html` 預宣告；WebGLRenderer 附掛既有元素，不 auto-create」
  - §2.7 新增「三 js 側規則」5 條：pre-declared canvas、`new WebGLRenderer({ canvas })`、`renderer.setSize(w, h, false)`、其他 inline-style-producing loaders 之明文排除（SVGLoader / CSS2DRenderer / CSS3DRenderer / EffectComposer parts）、sizing 責任分工（CSS 控視覺、three.js 控 buffer）
  - §5 CI 加 `three-inline-style-check` job：grep `new WebGLRenderer\(\s*\)`、`setSize\(...,\s*true\)` 或缺第三參數、`SVG(Loader|Renderer)` / `CSS[23]DRenderer` import
- **S1 → §2.2**：`use()` hook 屬 React 19（截至本 ADR rev.1 尚未 stable release）；從 allowed list 移除，明列於「❌ 排除」+ 標為 rev.2 candidate 若未來升 React 19。同步：§2.2 Suspense 說明改為「lazy resolution 或 promise wrapper 作為 trigger」，不依賴 `use()`。
- **S2 → §2.9 ESLint**：擴充 `no-restricted-imports` rule，除 `ui/` ↔ `render/` 單向依賴外，新增 `src/ui/screens/**` + `src/ui/hud/**` + `src/ui/components/**` **禁止**直接 import `src/engine/**`（只允許 `src/ui/bridge/**` 作為橋接單點）。附理由：繞過 `EngineBridge` 會造成 tearing 或 event 遺漏。
- **S3 → §2.3**：明訂「動態 class name 硬性禁令」小節，附 ✅/❌ 範例與 `clsx` helper 範式；若真需 runtime class 於 `tailwind.config.ts` 之 `safelist` 明列。§5 CI 加 `tailwind-dynamic-class-grep` job 攔 `className={\`...\${...\}\`}` 模式。
- **S4 → §2.6**：vendor chunk 目標由 rev.1 之 **120 KiB gzip 上調至 160 KiB gzip**（three.js @0.160 minimal build ~100 KiB + react + react-dom ~45 KiB + 15 KiB 緩衝）；總計初次載入目標由 275 KiB → **315 KiB gzip**。若實測仍超，新增三條升級路徑（拆 three 為獨立 chunk / 啟用 React.lazy / tree-shake 檢查未用 loaders）。
- **S5 → §2.7 / §5 影響既有 ADR**：cross-ref 對齊。ADR-0006 rev.2 §2.6 F5 原 rev.2 target 為「nonce-based」；本 ADR 使 `'self'`（無 nonce）可行。§5 明訂 **ADR-0006 rev.3** 應將 target 從「nonce-based」**改為 `'self'`**（更嚴格 + 更簡單，因 Tailwind JIT + 本 ADR §2.7 硬規則使 nonce 非必要）；rev.3 落地 timing 應與本 ADR-0007 之 CI CSP tightening 同一 PR 或緊隨其後。
- **S6 → §2.5 EngineBridge**：新增強制契約：
  - `snapshot` 之 immutability + memoization：`applyEvent` 只於欄位真變化時 return 新 reference，未變 return `prev`（早 return）；vitest 加測「emit no-op event × 100 → `getSnapshot()` 同一 reference」
  - `EngineBridge.resetForTest()` static method：每 test `afterEach` 呼叫，避免 singleton state 跨 test 洩漏；於 `tests/setup.ts` 補 hook
  - `dispose()` method：卸載 bus subscription + 清 subscribers；由 `resetForTest` 呼叫
- **N1 → §2.8**：vitest 之 `environment` 由全域 `jsdom` 改為 `environmentMatchGlobs`：`tests/ui/**` 走 jsdom、其他 `tests/**` 保留 node 環境（engine tests 啟動更快 + 避免 DOM 副作用）
- **N2 → §2.3**：`prefers-reduced-motion` 之處理由全域 `* !important` hack 改為 Tailwind `motion-reduce:` variant，per-元件控制；範例補入
- **N3 → §2.6**：bundle-size CI 上限明訂為「target × 1.20 fail、× 1.10 warn」（相對值，非絕對）
- **N4 → §2.3**：`@tailwindcss/forms` 之引入決策延後至 M8 P8.5 Settings 動工前；於該 PR body 記錄 bundle 影響。本 ADR 落地時**先不引入**
- **N5 → §2.3 code block + §5 file list**：`postcss.config.js` → `postcss.config.mjs`（`package.json` 為 `"type": "module"`）

**LA8 review 之「安全 / 簡化 總評」全數採納**：
- 無新增 `eval` / dynamic import / wasm / secret 注入風險
- Exact pin、no Redux、no Server Components、no `React.lazy` 之簡化選擇皆保留
- 跨 ADR 一致性經 S5 之對齊後齊全

**status**：Proposed → Accepted（LA8 verdict NEEDS_CHANGES + 全部 B1 / S1-S6 / N1-N5 已於本 rev.2 落實；待人類 approve 後 squash-merge）。

### rev.1 — 2026-07-22

初稿。依 ADR-0001 rev.5 §2.1 之「若後續選單/設定膨脹再引入 React 18 + Tailwind」條件觸發：

- UI 層邊界（Canvas / HUD overlay / Menu 系統 三層）（§2.1）
- React 18.3.1 版本 pin + concurrent hooks 使用範圍（§2.2）
- Tailwind 3.4.15 + PostCSS + JIT + CSP 相容 build-time class extraction（§2.3）
- 狀態管理：`useState` + `useSyncExternalStore`，spike 期無 Redux/Zustand（§2.4）
- Engine event bus ↔ React 橋接（`EngineBridge` 單例 + `useSyncExternalStore`）（§2.5）
- Bundle size 目標（初次載入 ≤ 275 KiB gzip）+ chunk 拆分（§2.6）
- CSP `style-src 'self'` 兼容（強制禁 inline style prop）（§2.7）
- 測試框架擴充（`@testing-library/react` + `jest-dom` + jsdom）（§2.8）
- 檔案結構 `src/ui/`（bridge / screens / hud / components）+ ESLint 單向依賴 rule（§2.9）
- 10 個 UI 元件清單對映開發計劃 v3 M8 P8.1-P8.10（§2.10）
- 12 個替代方案否決（Vanilla / Preact / Solid / Svelte / Vue / LitElement / UnoCSS / CSS-in-JS / CSS Modules / React 19 / Tailwind 4 / Zustand）
