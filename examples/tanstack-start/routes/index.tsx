import { createFileRoute } from '@tanstack/solid-router'
import { useTheme } from 'next-themes-solid'

export const Route = createFileRoute('/')({
  component: Home,
})

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')}
      style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
    >
      {resolvedTheme() === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}

function Home() {
  const { theme, resolvedTheme, systemTheme } = useTheme()

  return (
    <main style={{ padding: '2rem', font-family: 'sans-serif' }}>
      <h1>next-themes-solid — TanStack Start example</h1>
      <ThemeToggle />
      <pre style={{ margin-top: '1rem' }}>
        {JSON.stringify({ theme: theme(), resolvedTheme: resolvedTheme(), systemTheme: systemTheme() }, null, 2)}
      </pre>
    </main>
  )
}
