import { createMediaQuery } from '@solid-primitives/media'
import { makePersisted, storageSync } from '@solid-primitives/storage'
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  Show,
  untrack,
  useContext,
  type Accessor,
  type JSX,
  type Signal,
} from 'solid-js'
import { isServer } from 'solid-js/web'

import {
  applyTheme,
  MEDIA,
  resolveThemeConfig,
  themeScript,
  type ThemeAttribute,
  type ThemeConfig,
} from './script'

export {
  themeScript,
  type ThemeAttribute,
  type ThemeConfig,
  type ThemeScriptOptions,
} from './script'

/**
 * No-flash, system-aware theming for SolidJS / TanStack Start (Solid).
 *
 * Feature-complete against the next-themes contract this package replaces,
 * reimplemented solid-first:
 *
 * - **One applier, two callers.** The provider and the pre-paint script share
 *   a single `applyTheme` implementation (see `./script`), so they cannot
 *   disagree about what a theme means — a disagreement is exactly a flash.
 * - **Persistence** via `@solid-primitives/storage` (`makePersisted`) with an
 *   identity codec, so localStorage holds `dark` — not `"dark"` — keeping the
 *   pre-paint script and any external reader compatible.
 * - **Live system tracking** via `@solid-primitives/media`
 *   (`createMediaQuery`): OS switches update `system` followers instantly.
 * - **Cross-tab sync** via `@solid-primitives/storage`'s `storageSync`:
 *   changes made in another tab are adopted automatically.
 * - **Zero unnecessary effects**: DOM application is a `createEffect`
 *   (external system sync) while all derived values are `createMemo`.
 *
 * **Placement matters.** For no flash the script must run before first paint,
 * which means `<head>` — ahead of where a provider in `<body>` can put it.
 * The convenience default (`injectScript`) renders it inline where the
 * provider sits; prefer the explicit form:
 *
 * ```tsx
 * <head><script innerHTML={themeScript(options)} /></head>
 * <body><ThemeProvider {...options} injectScript={false}>…</ThemeProvider></body>
 * ```
 */

export type Theme = string

export type ThemeProviderProps = {
  children: JSX.Element
  /** Available theme names. Default `['light', 'dark']` (+ `'system'`). */
  themes?: Theme[]
  /** Lock the page to this theme regardless of preference. */
  forcedTheme?: Theme
  /** Follow `prefers-color-scheme` when the preference is `"system"`. Default true. */
  enableSystem?: boolean
  /** Suppress CSS transitions during a switch. Default false. */
  disableTransitionOnChange?: boolean
  /** Mirror the resolved mode into `<html style="color-scheme">`. Default true. */
  enableColorScheme?: boolean
  /** localStorage key. Default `"theme"`. */
  storageKey?: string
  /** Default when nothing is stored. `"system"` when enableSystem, else `"light"`. */
  defaultTheme?: Theme
  /**
   * Where the mode lands: `"class"`, any `data-*` attribute (default
   * `"data-theme"`), or several at once.
   */
  attribute?: ThemeAttribute | ThemeAttribute[]
  /** Remap theme names to attribute/class values. */
  value?: Record<string, string>
  /** CSP nonce for the injected pre-paint script. */
  nonce?: string
  /** Render the pre-paint script yourself, in `<head>`. Default true. */
  injectScript?: boolean
}

type ThemeContextValue = {
  themes: Theme[]
  forcedTheme: Theme | undefined
  theme: Accessor<Theme>
  resolvedTheme: Accessor<Theme>
  systemTheme: Accessor<'light' | 'dark'>
  /** Accepts a theme name or an updater, like the next-themes setter. */
  setTheme: (theme: Theme | ((prev: Theme) => Theme)) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>')
  return ctx
}

/** Suppress CSS transitions for a single paint cycle. */
function suppressTransitionsOnce() {
  const style = document.createElement('style')
  style.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(style)
  // Force a style recalculation so the rule takes before the DOM change.
  void window.getComputedStyle(document.body).transition
  setTimeout(() => style.remove(), 1)
}

/**
 * Safe localStorage wrapper — treats any access failure as "nothing stored".
 * Covers Safari private mode, storage quota errors, and SSR environments.
 */
const safeStorage = {
  getItem: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  setItem: (key: string, value: string) => { try { localStorage.setItem(key, value) } catch {} },
  removeItem: (key: string) => { try { localStorage.removeItem(key) } catch {} },
}

/** Passthrough when nested — only the outermost provider owns the DOM. */
export function ThemeProvider(props: ThemeProviderProps) {
  if (useContext(ThemeContext)) return props.children as JSX.Element
  return <ThemeImplementation {...props} />
}

function ThemeImplementation(props: ThemeProviderProps) {
  const config = createMemo<ThemeConfig>(() =>
    resolveThemeConfig({
      attribute: props.attribute,
      storageKey: props.storageKey,
      defaultTheme: props.defaultTheme ?? (props.enableSystem === false ? 'light' : 'system'),
      forcedTheme: props.forcedTheme,
      themes: props.themes,
      value: props.value,
      enableSystem: props.enableSystem,
      enableColorScheme: props.enableColorScheme,
    }),
  )

  // The storage binding is fixed at creation — read once, outside tracking.
  const { storageKey, defaultTheme } = untrack(config)

  // Identity codec: localStorage must hold exactly what the pre-paint script
  // reads back — `dark`, not makePersisted's default JSON `"dark"`.
  const [preference, setPreference] = makePersisted<Theme, Signal<Theme>>(
    createSignal<Theme>(defaultTheme),
    {
      name: storageKey,
      serialize: (v) => v,
      deserialize: (v) => v,
      // storageSync touches `window`, so it is client-only.
      sync: isServer ? undefined : storageSync,
      storage: isServer ? undefined : safeStorage,
    },
  )

  const prefersDark = createMediaQuery(MEDIA)
  const systemTheme = createMemo<'light' | 'dark'>(() => (prefersDark() ? 'dark' : 'light'))

  /** Resolve `"system"` to the concrete mode it currently means. */
  const resolve = (theme: Theme): Theme =>
    config().enableSystem && theme === 'system' ? systemTheme() : theme

  const resolvedTheme = createMemo(() => resolve(preference()))

  // DOM application is an effect — it syncs with an external system (the DOM).
  // Transitions are suppressed only on an actual change, never on the initial
  // adoption (which has nothing to cross-fade from).
  if (!isServer) {
    let prev: Theme | undefined
    createEffect(() => {
      const mode = resolve(props.forcedTheme ?? preference())
      if (props.disableTransitionOnChange && prev !== undefined && prev !== mode) {
        suppressTransitionsOnce()
      }
      prev = mode
      applyTheme(config(), mode, document.documentElement)
    })
  }

  // Getters, not snapshots — these track their props reactively.
  const value: ThemeContextValue = {
    get themes() {
      const { themes, enableSystem } = config()
      return enableSystem ? [...themes, 'system'] : themes
    },
    get forcedTheme() { return props.forcedTheme },
    theme: preference,
    resolvedTheme,
    systemTheme,
    setTheme: (update) =>
      setPreference(typeof update === 'function' ? update(preference()) : update),
  }

  return (
    <ThemeContext.Provider value={value}>
      <Show when={props.injectScript !== false}>
        <script nonce={props.nonce} innerHTML={themeScript(config())} />
      </Show>
      {props.children}
    </ThemeContext.Provider>
  )
}
