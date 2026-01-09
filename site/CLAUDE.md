# site/CLAUDE.md

Turboshovel marketing website - static Astro site with Tailwind CSS.

## Commands

```bash
npm run dev      # Start dev server (localhost:4322)
npm run build    # Build to dist/
npm run preview  # Preview production build
```

## Tech Stack

- Astro 5.x (static output)
- Tailwind CSS 3.x (@astrojs/tailwind)
- Deployed to Cloudflare Pages

## Structure

- `src/components/` - Astro components (Hero, Features, QuickStart, Conventions, Footer)
- `src/layouts/` - Page layouts
- `src/pages/` - Routes (index.astro)
- `public/` - Static assets (favicon.svg)

## Theme

Cyberpunk color palette defined in `tailwind.config.mjs`:
- `cyber-cyan` (#00E5FF)
- `cyber-magenta` (#FF00E5)
- `cyber-purple` (#9B4DFF)
