/**
 * The serializable core.
 *
 * The pre-paint script and the running provider must apply a theme *identically* —
 * any disagreement between them is, by construction, a flash. So there is exactly
 * one implementation ({@link applyTheme}), used directly at runtime and serialized
 * into the inline script via `toString()`.
 *
 * That serialization is why {@link applyTheme} must stay **self-contained**: no
 * imports, no module-scope references, and none of the syntax bundlers desugar
 * into injected helpers (spread in calls, `for...of`, `async`). It reads its whole
 * world from the `config` argument. Keep it that way — a reference to anything
 * outside its own body compiles fine and breaks only in the browser, silently, as
 * the flash this package exists to prevent.
 */

export type ThemeAttribute = 'class' | `data-${string}`

/** Fully-resolved settings. Serialized into the script as a JSON payload. */
export type ThemeConfig = {
  attribute: ThemeAttribute[]
  storageKey: string
  defaultTheme: string
  forcedTheme?: string
  themes: string[]
  value: Record<string, string> | null
  enableSystem: boolean
  enableColorScheme: boolean
}

export type ThemeScriptOptions = Partial<Omit<ThemeConfig, 'attribute'>> & {
  attribute?: ThemeAttribute | ThemeAttribute[]
}

export const MEDIA = '(prefers-color-scheme: dark)'

/**
 * Put an already-resolved mode on the element. `mode` is concrete — `"system"`
 * has been resolved to `"light"`/`"dark"` by the caller, which is the only step
 * the script and the provider do differently (`matchMedia` vs. a signal).
 *
 * Self-contained by contract — see the module header before editing.
 */
export function applyTheme(config: ThemeConfig, mode: string, element: HTMLElement): void {
  const map = config.value
  const name = (map && map[mode]) || mode

  for (let i = 0; i < config.attribute.length; i++) {
    const attr = config.attribute[i]!
    if (attr === 'class') {
      for (let j = 0; j < config.themes.length; j++) {
        const t = config.themes[j]!
        element.classList.remove((map && map[t]) || t)
      }
      if (name) element.classList.add(name)
    } else {
      // ThemeAttribute is 'class' | `data-${string}` — anything else is a data attribute.
      if (name) element.setAttribute(attr, name)
      else element.removeAttribute(attr)
    }
  }

  if (config.enableColorScheme && (mode === 'light' || mode === 'dark')) {
    element.style.colorScheme = mode
  }
}

/** Fill in every default and normalize `attribute` to an array. */
export function resolveThemeConfig(options: ThemeScriptOptions = {}): ThemeConfig {
  return {
    attribute:
      options.attribute === undefined
        ? ['data-theme']
        : Array.isArray(options.attribute)
          ? options.attribute
          : [options.attribute],
    storageKey: options.storageKey ?? 'theme',
    defaultTheme: options.defaultTheme ?? 'system',
    forcedTheme: options.forcedTheme,
    themes: options.themes ?? ['light', 'dark'],
    value: options.value ?? null,
    enableSystem: options.enableSystem !== false,
    enableColorScheme: options.enableColorScheme !== false,
  }
}

/**
 * The pre-paint script: reads the stored preference and applies it before the
 * browser paints. Place it in `<head>` — that is the only position that
 * reliably beats first paint (see `<ThemeProvider injectScript={false}>`).
 *
 * The applier is bound to a local (`var f=(…)`) rather than called by name,
 * so a minifier renaming the function cannot break the emitted call.
 */
export function themeScript(options: ThemeScriptOptions = {}): string {
  const config = resolveThemeConfig(options)
  const media = JSON.stringify(MEDIA)

  return [
    '(function(){',
    `var c=${JSON.stringify(config)};`,
    `var f=(${applyTheme.toString()});`,
    'var m=c.forcedTheme;',
    'if(!m){try{m=localStorage.getItem(c.storageKey)}catch(e){}}',
    'if(!m)m=c.defaultTheme;',
    `if(c.enableSystem&&m==='system')m=window.matchMedia(${media}).matches?'dark':'light';`,
    'f(c,m,document.documentElement)',
    '})()',
  ].join('')
}
