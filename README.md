# Framer Clone

A Framer-style visual website builder that runs entirely on your machine. Design real websites on an infinite canvas — every save writes a full, readable React codebase to disk.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173. This starts two processes:

- **Editor** (Vite) on port 5173
- **Local server** (Express) on port 4570 — owns the `projects/` folder on disk

## Where your work lives

Every project is a plain folder you can open in any code editor:

```
projects/<project-name>/
  framer.json     # the design document (source of truth)
  assets/         # images you upload
  site/           # generated React (Vite) codebase — regenerated on every save
    src/pages/        # one component per page
    src/components/   # components you create in the editor
    src/cms/data.ts   # CMS collections as typed data
    src/styles.css    # all styling, breakpoints as media queries
```

The `site/` folder is a standalone app: `cd projects/<name>/site && npm install && npm run dev` runs your published site by itself. Note that `site/` is regenerated on every save, so make design changes in the editor, not by editing generated files.

## Editor overview

- **Canvas** — one artboard per breakpoint (desktop 1200 / tablet 810 / phone 390). Scroll to pan, `⌘`+scroll to zoom, space-drag to pan. Click to select, double-click to drill in or edit text, drag to move with snapping, right-click for the context menu.
- **Left panel** — Pages, Layers (drag to reorder/reparent, rename, hide, lock), Assets (images, color styles, text styles), CMS, and Insert (primitives + prebuilt sections).
- **Right panel** — all properties of the selection: position, size modes (fixed/fill/relative/fit), stack & grid layout, fills & gradients, borders, radius, shadows, blur, typography, links, effects.
- **Breakpoints** — design desktop-first; edits at tablet/phone become overrides (blue dot in the panel, click to reset).
- **Components** — right-click a frame → Create Component. Purple = component. Double-click an instance to edit the master; all instances update.
- **CMS** — create collections with typed fields and entries, drop a collection list on a page, bind text/images to fields, and generate detail pages at `/collection/:slug`.
- **Effects** — entrance animations (on load or on scroll), hover and press states, powered by Framer Motion in preview and in the generated code.
- **Timeline animations** — click **Animate** in the toolbar to open the bottom drawer. Create clips per page, add tracks for X/Y/Scale/Rotate/Opacity on selected layers, drag keyframes on the horizontal timeline, scrub with the playhead, and play back live on the canvas. Clips export to the generated site as Framer Motion keyframe animations.
- **Preview** — the real site with working links, CMS routes, and animations at any device width.
- **Publish** — runs a production build (`vite build`) of the generated site; the deployable output lands in `projects/<name>/site/dist/`.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `V` / `F` / `S` / `T` / `H` | Select / Frame / Stack / Text / Hand tools |
| `I` | Insert panel |
| `1` / `2` / `3` | Desktop / Tablet / Phone breakpoint |
| `⌘Z` / `⇧⌘Z` | Undo / Redo |
| `⌘C` `⌘X` `⌘V` `⌘D` | Copy / Cut / Paste / Duplicate |
| `⌘⏎` | Wrap selection in a stack |
| `⌘K` | Create component from selection |
| `⌘[` / `⌘]` | Send backward / bring forward |
| Arrows / `⇧`+Arrows | Nudge 1px / 10px |
| `⏎` / `Esc` | Drill into first child / select parent |
| `0`, `+`, `-` | Reset zoom / zoom in / zoom out |

## Architecture

- `src/model/` — document model, breakpoint cascade resolution, style → CSS compiler (shared by canvas, preview, and codegen)
- `src/store/` — Zustand stores: document (with snapshot undo/redo and debounced autosave) and editor UI state
- `src/canvas/` — infinite canvas, DOM renderer, selection/drag/resize/snap interactions, overlays
- `src/properties/` — properties panel controls
- `src/insert/` — template library (primitives + sections)
- `src/codegen/` — React code generator (runs on the server on every save)
- `src/preview/` — in-editor live preview with routing and animations
- `server/` — Express server: project CRUD on disk, asset uploads, codegen trigger, publish builds
