import { createRootRoute, Outlet, ScrollRestoration } from '@tanstack/solid-router'
import { Meta, Scripts } from '@tanstack/start'
import { ThemeProvider } from 'next-themes-solid'
import { themeScript } from 'next-themes-solid/script'

export const Route = createRootRoute({
  component: Root,
})

function Root() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/*
          Place themeScript() in <head> — before any CSS or body content.
          This is what prevents the flash. Pass injectScript={false} to the
          provider so it doesn't also inject it down in the body.
        */}
        <script innerHTML={themeScript({ attribute: 'class', defaultTheme: 'system' })} />
        <Meta />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" injectScript={false}>
          <ScrollRestoration />
          <Outlet />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  )
}
