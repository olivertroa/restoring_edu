# Restoring EDU Design 1

An isolated, fully routed redesign prototype inspired by the editorial education language of Skillex. It uses Restoring Education's archived copy, page hierarchy, citations, and media while introducing a new visual system.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173/`.

## Production build

```bash
npm run build
npm run preview
```

## Content coverage

- 189 data-driven routes generated from `../content-export/`
- Homepage, news, grading methodology, and District Watch landing pages
- 51 state and District of Columbia scorecards
- District Watch state hubs and district directories
- Person, policy, and legacy post templates
- Localized media paths for the complete WordPress archive
- Search across states, districts, people, policies, and posts

Run `npm run content` after changing the archived content. This regenerates `src/data/site-content.json` without changing the design layer.

## Design system

- Editorial off-white canvas with charcoal controls and a restrained sage accent
- Avenir-style rounded system typography
- Large asymmetric image panels inspired by the reference site's rhythm
- Soft 18px and 30px content radii, with pill controls
- Responsive single-column fallbacks below 820px
- System-aware light and dark themes with a manual toggle
- Reduced-motion and reduced-transparency support

The generated hero photograph is stored at `public/media/generated/design-1-education-hero.png`. All other page imagery comes from the archived Restoring Education site.
