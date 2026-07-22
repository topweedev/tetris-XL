---
title: ADR-0007 UI Stack — React 18 + Tailwind CSS for Menus and Screens
type: decision
status: proposed
adr_id: "0007"
repo: topweedev/tetris-XL
path: docs/adr/0007-ui-stack-react-tailwind.md
tags: [adr, tetris-xl, ui, react, tailwind, frontend, bundle-size]
---

# ADR-0007: UI Stack — React 18 + Tailwind CSS 於選單與畫面層

- 狀態：Proposed
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
| **Canvas 層** | 3D 井道、piece、消行動畫、camera | three.js @0.160.1（ADR-0001 §2.5） | 每 frame（60 Hz） |
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
- ✅ `useSyncExternalStore`：訂閱 engine event bus 之穩定原語（避免 tearing）
- ✅ `useTransition` + `useDeferredValue`：Highscores / Replay browser 之長列表過濾之非阻塞更新
- ✅ `Suspense`：Replay browser 之 IndexedDB 讀取邊界；配合 `use()` hook（React 19 未定，本 ADR 鎖 18.x）
- ❌ Server Components：本作為純 client SPA，無 SSR
- ❌ `renderToString` / hydration：無 SSR
- ❌ `React.lazy` + code-split：spike 期單 bundle；rev.2 可能引入

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
  plugins: [
    // '@tailwindcss/forms' 若引入，於此
  ],
} satisfies Config;
```

**Global CSS**（`src/ui/index.css`）：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 基座 reset extension、reduce-motion 支援 */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

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

class EngineBridge {
  static readonly instance = new EngineBridge();
  private subscribers = new Set<Subscriber>();
  private snapshot: GameStateSnapshot = getInitialSnapshot();
  private constructor() {
    getEngineBus().on('*', (event: EngineEvent) => {
      this.snapshot = this.applyEvent(this.snapshot, event);
      this.subscribers.forEach(fn => fn());
    });
  }
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  getSnapshot(): GameStateSnapshot { return this.snapshot; }
  private applyEvent(prev: GameStateSnapshot, event: EngineEvent): GameStateSnapshot {
    // 只更新 UI 相關欄位；不觸發 tick 邏輯
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

**規則**：

- Bridge 之 snapshot 為**不可變**（React 重繪偵測靠 reference identity）
- Bridge 只讀 event bus；**不**寫入 fsm state
- React 之「按開始遊戲」按鈕 → `bridge.dispatchAction(GameAction.Start)` → engine consumes；不直接改 `GameState`

### 2.6 Bundle size 目標與 chunk 拆分

**目標**（於 M4 MVP 加 M8 完成後之 `pnpm build` 產出）：

| Chunk | 內容 | 目標大小（gzip） |
|-------|------|------------------|
| `index.js`（entry） | React root + Menu 系統 + Engine bridge | ≤ **80 KiB** |
| `vendor.js`（split） | react + react-dom + three | ≤ **120 KiB** |
| `game.js`（split，optional） | engine core + persistence | ≤ **60 KiB** |
| `styles.css` | Tailwind JIT 輸出 | ≤ **15 KiB** |
| **總計初次載入** | | ≤ **275 KiB** gzip |

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

**Guardrail**：於 CI 加 `bundle-size` job（可用 `bundlesize` npm 或手寫 script），若超上限 20% 則 fail。

### 2.7 CSP `style-src` 相容性

**問題**：ADR-0006 §2.6 F5 現況允許 `style-src 'self' 'unsafe-inline'`（spike 期）；rev.2 target 為 nonce-based。

**Tailwind 之影響**：

- Tailwind JIT **build-time** 產出靜態 CSS 檔（`dist/styles.css`）→ 走 `<link rel="stylesheet">` → CSP `style-src 'self'` 即可載入，**無需 unsafe-inline**
- React 之 `style={...}` inline prop **會**產生 inline style → 需 unsafe-inline 或 nonce
- Tailwind class-based 寫法（`className="text-lg font-bold"`）**不**產生 inline style，僅套用預先 build 出來的 class → CSP-friendly

**規則**（強制執行）：

- React 元件**禁止** `style={...}` prop；一律用 Tailwind class
- 動態 style（例：progress bar 之 `width`）走 Tailwind `w-[<value>]` arbitrary value（build 時已由 JIT 掃出），或走 CSS custom property + Tailwind `w-[var(--w)]` 於 style prop 之外（rev.2 收緊時再議）
- 例外：canvas 之動態尺寸走 three.js renderer.setSize（不經 style prop）

**目標**：本 ADR merge 後，CSP 之 `style-src` **可立即收緊為 `'self'`**（移除 `'unsafe-inline'`）；此為 ADR-0006 §2.6 F5 rev.2 target 之提早實現。

### 2.8 Test 框架擴充

**新增 dev deps**：

```
@testing-library/react@16.1.0
@testing-library/jest-dom@6.6.3
@testing-library/user-event@14.5.2
jsdom@25.0.1（vitest 之 dom env；若已裝可略）
```

**Vitest 設定**（`vitest.config.ts` 更新）：

```ts
export default {
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: false,   // 明示 import，不用全域
  },
};
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
    screens/
      MainMenu.tsx      ← Main menu / start screen
      PauseOverlay.tsx
      GameOverScreen.tsx
      SettingsPage.tsx
      RebindingEditor.tsx
      HighscoresView.tsx
      ReplayBrowser.tsx
      ReplayShareModal.tsx
      ReplayErrorToast.tsx
      CameraModeToggle.tsx
    hud/                ← 遊戲進行中之疊層元件
      HUDRoot.tsx
      ScoreFloat.tsx
      ComboIndicator.tsx
      B2BBar.tsx
      SpinEffect.tsx
      HoldSlotPreview.tsx
    components/         ← 共用小元件
      Button.tsx
      Modal.tsx
      Toast.tsx
      NumericInput.tsx
      KeyCapture.tsx    ← Rebinding editor 之單鍵擷取
tailwind.config.ts      ← NEW
postcss.config.js       ← NEW
```

**規則**：

- `src/ui/` 之檔案**不得** import `src/render/` （單向依賴：`ui/` → `bridge/` ← `engine/`）
- `src/render/` 之檔案**不得** import `src/ui/` （純 canvas 層）
- `src/engine/` 保持零外部依賴（除 zod / idb per ADR-0006 §5）

ESLint rule（新增於 `eslint.config.js`）：

```js
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
```

### 2.10 UI 元件清單 · 對映開發計劃 v3 M8 phases

| Phase | 元件 | 依賴 ADR § |
|-------|------|------------|
| **P8.1** HUD | `HUDRoot`, `ScoreFloat`, `ComboIndicator`, `B2BBar`, `SpinEffect`, `HoldSlotPreview` | ADR-0005 §2.6 全 8 事件 |
| **P8.2** Main menu | `MainMenu` | 導航需求 |
| **P8.3** Pause overlay | `PauseOverlay` | ADR-0004 §2.3 Pause |
| **P8.4** Game over | `GameOverScreen` | 導航需求 |
| **P8.5** Settings page | `SettingsPage`, `CameraModeToggle` | ADR-0006 §2.5 `SettingsSchema` |
| **P8.6** Rebinding editor | `RebindingEditor`, `KeyCapture` | ADR-0004 §2.8 |
| **P8.7** Highscores view | `HighscoresView` | ADR-0006 §2.5 `HighscoresSchema` |
| **P8.8** Replay browser | `ReplayBrowser`, `ReplayShareModal` | ADR-0006 §2.1 L1b/L1c |
| **P8.9** Replay share/import | `ReplayShareModal`, `ReplayErrorToast` | ADR-0006 §2.4 |
| **P8.10** Touch overlay [optional] | 走 `src/render/` 之 touch canvas 疊層，**非** React（因需與 canvas 同座標系） | ADR-0004 §2.7 |

## 3. 已考慮的替代方案 (Alternatives Considered)

- **維持 Vanilla DOM + 手寫 CSS**：無新相依樹，最小 bundle。但 10 個畫面 × 平均 200 LOC + CSS = ~2500 LOC 手寫，狀態管理易 spaghetti，元件無法 unit test（需 Playwright DOM diffing 才能驗證）。已否決；ADR-0001 §2.1 之「後續選單膨脹再引入」門檻已達
- **Preact @10.x + Tailwind**：React API 相容、bundle 極小（~4 KiB gzip vs React 18 ~45 KiB）。但 `@testing-library/react` 需 `preact/compat` shim；React 18 concurrent 特性（`useTransition`）需額外相容層或不可用。已否決；本作非 mobile-first / bandwidth-critical，React 之生態更成熟
- **Solid.js**：無 VDOM，效能極佳，bundle 小。但 API 陌生（signals 語意學習曲線）、testing 生態較弱、與 three.js 之整合案例少於 React。已否決；spike 期不冒學習曲線風險
- **Svelte 5**：語法簡潔，編譯輸出小。但需引入 `.svelte` 檔類型（vite plugin + vscode extension），與現有純 `.ts` 檔混寫增加 build complexity；且 Svelte 5 runes 為新 API，穩定性未證實。已否決
- **Vue 3 + `<script setup>`**：生態成熟，中文社群龐大。但 template DSL 對 TS type-inference 支援仍弱於 JSX；與 three.js 整合案例少。已否決
- **LitElement + Web Components**：無框架 lock-in、web-standard。但 shadow DOM 與 Tailwind 之全域 utility class 不相容（每個 shadow root 需獨立注入 CSS，違背 JIT 之 single stylesheet 假設）。已否決
- **UnoCSS 取代 Tailwind**：更快之 JIT、smaller bundle。但社群與 preset 生態不及 Tailwind；`@tailwindcss/forms` 之等價於 UnoCSS 需自行維護 preset。已否決；優點不足以換掉 Tailwind 之成熟度
- **CSS-in-JS（styled-components / emotion）**：runtime style 產出、React 元件內共存。但**與 CSP `style-src 'self'` 不相容**（會產生 inline `<style>` tags 需 unsafe-inline）；且 runtime 開銷 ~20 KiB。已否決；違反本 ADR §2.7 之安全目標
- **CSS Modules**：build-time 局部 scope，無 runtime 開銷。但無 utility class 之快速 prototyping 效率；每個元件需寫 `.module.css`。已否決；於 spike 期 velocity 不划算
- **React 19（beta / rc）**：`use()` hook、Actions API 更成熟。但截至 2026-07 尚未 stable release；testing lib 相容性未證實。**Rev.2 candidate**；本 ADR 鎖 18.x
- **Tailwind 4.x（alpha）**：CSS-first config、Rust engine 更快。API 未穩定；plugin 生態相容性未證實。已否決；鎖 3.4.x
- **引入 Zustand / Jotai / Redux Toolkit 全域 store**：跨畫面狀態統一。本作 UI-only state 作用域小、engine state 已有 fsm.step 唯一 source → 全域 store overkill。已否決；rev.2 若 Settings 頁膨脹再議

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
- **`tailwind.config.ts`**、**`postcss.config.js`** 新建
- **`src/ui/main.tsx`**、**`src/ui/UIRoot.tsx`**（skeleton）、**`src/ui/index.css`** 新建
- **`src/ui/bridge/EngineBridge.ts`** + `useEngineSnapshot.ts` + `useDispatchAction.ts`
- **`index.html`** 加 `<div id="ui-root">` + `<link rel="stylesheet" href="/dist/styles.css">`（vite 自動注入）
- **`eslint.config.js`** 新增 `no-restricted-imports` for `ui/` ↔ `render/` 邊界
- **`vitest.config.ts`** 之 environment 改為 jsdom；`tests/setup.ts` 加 `@testing-library/jest-dom` 匯入
- **`vite.config.ts`** `manualChunks` 加 vendor / game split
- **CI 加 bundle-size job**（本 ADR §2.6 之 guardrail）

### 影響既有 ADR

- **ADR-0001 rev.6 candidate**：§2.1 之「MVP 採 vanilla DOM overlay；若後續選單/設定膨脹再引入 React 18 + Tailwind」之後半條件已於本 ADR 落地；rev.6 補述「條件已觸發，per ADR-0007」
- **ADR-0006 rev.3 candidate**：§2.6 F5 之 `style-src 'self' 'unsafe-inline'` 可收緊為 `'self'`；此 rev 應與本 ADR 之 CI CSP-check 同步

### 實作階段（M8）

- 依開發計劃 v3 M8 之 P8.1-P8.10 順序執行；每 phase 之 UI 元件於本 ADR §2.10 表已列
- Bridge 之 memoization 落實：`snapshot` 之 subset selector（例：`useCombo()` 只訂閱 combo 欄位）
- Storybook（optional）：若元件展示需求出現，rev.2 candidate

### CI 硬規則檢查

- `bundle-size` job：於 PR 加 `pnpm build --report` 之 dist 大小 diff comment
- `css-purge-check`：驗證 `dist/styles.css` 不含未使用之 utility class（Tailwind JIT 應保證，但加 belt-and-braces）
- `csp-inline-style-grep`：於 `src/ui/**/*.tsx` grep `style={` → 若命中 fail（強制執行本 ADR §2.7 之規則）

## 6. 修訂紀錄 (Revision History)

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
