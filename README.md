# next-themes-solid

> No-flash, system-aware theming for SolidJS.  
> The `next-themes` contract — solid-first implementation.

```bash
bun add git+https://github.com/ryanm455/next-themes-solid
```

## Why

`next-themes` is React/Next.js-only. The SolidJS ecosystem had no equivalent that:

- **Prevents the flash** — the pre-paint inline `<script>` runs before the browser's first paint, so the stored preference is applied before anything is visible
- **Tracks the OS** live — system theme changes update instantly via `@solid-primitives/media`
- **Syncs across tabs** — via `@solid-primitives/storage`'s `storageSync`
- **Uses one applier** — the provider and the script share a single `applyTheme` implementation, so they can't disagree about what a theme means (a disagreement is exactly a flash)
- **Follows SolidJS conventions** — `createEffect` for DOM writes, `createMemo` for derivation, `createSignal` for state; zero `useEffect` anti-patterns

---

## Installation

```bash
# bun
bun add git+https://github.com/ryanm455/next-themes-solid

# npm
npm install git+https://github.com/ryanm455/next-themes-solid

# pnpm
pnpm add git+https://github.com/ryanm455/next-themes-solid
```

### Vite config (required)

Because this package ships TypeScript source, your `vite-plugin-solid` must be told to process it:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    solid({
      include: [/next-themes-solid/],  // <-- add this
    }),
  ],
})
```

---

## Setup

### TanStack Start

The script **must** be in `<head>` to beat first paint. The provider goes in `<body>`.

```tsx
// app/root.tsx
import { themeScript } from 'next-themes-solid/script'
import { ThemeProvider } from 'next-themes-solid'

export default function Root() {
  return (
    <html lang="en">
      <head>
        {/* Inline before any CSS or body content */}
        <script innerHTML={themeScript()} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" injectScript={false}>
          <Outlet />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### SolidStart

```tsx
// src/app.tsx
import { themeScript } from 'next-themes-solid/script'
import { ThemeProvider } from 'next-themes-solid'

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <Head>
            <script innerHTML={themeScript()} />
          </Head>
          <ThemeProvider attribute="class" defaultTheme="system" injectScript={false}>
            {props.children}
          </ThemeProvider>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
```

---

## ThemeToggle

```tsx
import { useTheme } from 'next-themes-solid'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {resolvedTheme() === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

---

## API

### `<ThemeProvider>`

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `attribute` | `"class" \| "data-*" \| Array` | `"data-theme"` | Where the active theme is written on `<html>` |
| `defaultTheme` | `string` | `"system"` | Theme used when nothing is stored |
| `forcedTheme` | `string` | — | Lock the page to this theme, ignoring preference |
| `enableSystem` | `boolean` | `true` | Resolve `"system"` via `prefers-color-scheme` |
| `enableColorScheme` | `boolean` | `true` | Set `color-scheme` style on `<html>` |
| `disableTransitionOnChange` | `boolean` | `false` | Suppress CSS transitions during a theme switch |
| `storageKey` | `string` | `"theme"` | `localStorage` key |
| `themes` | `string[]` | `["light", "dark"]` | Available theme names |
| `value` | `Record<string, string>` | — | Map theme names to attribute/class values |
| `nonce` | `string` | — | CSP nonce for the injected script |
| `injectScript` | `boolean` | `true` | Inject the pre-paint script inline. Set `false` when you place the script in `<head>` yourself (recommended) |

### `useTheme()`

```ts
const {
  theme,          // Accessor<string>   — stored preference ("light" | "dark" | "system" | …)
  resolvedTheme,  // Accessor<string>   — concrete mode ("light" or "dark"), never "system"
  systemTheme,    // Accessor<"light" | "dark">  — current OS preference
  setTheme,       // (theme: string | ((prev: string) => string)) => void
  themes,         // string[]           — all available themes including "system"
  forcedTheme,    // string | undefined — the forced theme if one is set
} = useTheme()
```

### `themeScript(options?)`

Returns the inline script string to place in `<head>`. Accepts the same options as `<ThemeProvider>`.

```ts
import { themeScript } from 'next-themes-solid/script'

// In your SSR head:
const script = themeScript({ attribute: 'class', defaultTheme: 'dark' })
```

---

## How it works

**The flash problem:** if the browser paints before it knows the stored preference, users see the wrong theme for a frame before JavaScript corrects it.

**The solution:** a tiny self-contained script runs synchronously in `<head>` before any CSS or body content is parsed. It reads `localStorage`, resolves `"system"` via `window.matchMedia`, and writes the theme attribute to `<html>` — all before first paint.

**One applier, no disagreement:** the `applyTheme` function is defined once in `script.ts` and used in two places:
1. Serialized via `.toString()` into the inline `<script>` tag
2. Called directly by the `ThemeProvider`'s `createEffect`

Because they share the same implementation, the provider always adopts exactly what the script set — no reconciliation flash.

---

## Differences from `next-themes`

| | `next-themes` | `next-themes-solid` |
|:---|:---|:---|
| Framework | React / Next.js | SolidJS / TanStack Start / SolidStart |
| State | `useState` + `useEffect` | `createSignal` + `createEffect` + `createMemo` |
| System tracking | `useEffect` + `addEventListener` | `@solid-primitives/media` (`createMediaQuery`) |
| Cross-tab sync | `useEffect` + `storage` event | `@solid-primitives/storage` (`storageSync`) |
| Persistence | `useEffect` + manual `localStorage` | `@solid-primitives/storage` (`makePersisted`) |
| Flash prevention | Inline `<script>` | Same — shared `applyTheme` implementation |

---

## License

MIT © 2026 ryanm455
