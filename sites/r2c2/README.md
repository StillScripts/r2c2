# R2C2 marketing site

The source of the R2C2 marketing site, the first site on R2C2.

- `theme.css` is the site's theme: `@theme` tokens (colours, fonts, radii, type sizes, page width), base styles, and the component classes the page uses (`section`, `btn`, `card`, `tile` and the rest).
- `index.html` is the home page. Every class in it is a theme token or a component class, so `packages/html` checks it against the house rules (SPEC §12) in `src/sites.test.ts`.

The page uses system fonts and no images until sites can upload media. The contact section is a `<site-form name="contact">`, so enquiries land in the Loft inbox.

## Loading it into the Loft

With the Convex dev deployment running and seeded, load the theme and every `*.html` page as drafts (`index.html` is `/`, `about.html` would be `/about`). Each import shows up in the page's history as "Imported":

```bash
vp run --filter @workspace/backend seed
vp run --filter @workspace/backend site:import
```

Then publish the home page from the Loft. Importing again overwrites the drafts, not what's live. Any draft edits not yet in history get a snapshot first, so you can restore them. The script checks that the theme compiles and that every page fits before it writes anything.
