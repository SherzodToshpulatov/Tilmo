# Tilmo brand

The Tilmo mark is a **T** whose crossbar is split into two halves at slightly
different heights — one cyan, one solid — a quiet nod to switching between
languages. It is built from three rounded rectangles on a 128-unit grid with
16-unit strokes, so it stays a recognisable T at 16×16.

| File | Use |
| --- | --- |
| `assets/brand/tilmo-logo.svg` | Primary symbol, transparent background (navy, or light in dark mode) |
| `assets/brand/tilmo-wordmark.svg` | Symbol with the "Tilmo" lettering, drawn as vector strokes |
| `assets/brand/tilmo-icon-dark.svg` | App icon on a navy tile — source for `public/icon/*.png` |
| `assets/brand/tilmo-icon-light.svg` | App icon on a light tile |

Palette: cyan `#22D3EE`, navy `#0F172A`, light `#F8FAFC`. Cyan is used as a
fill or on navy; on light backgrounds, text and focus rings use the deeper
`#0E7490`, because `#22D3EE` on white is below the 3:1 contrast minimum.

Internal identifiers keep the original project name so existing setups keep
working: the GitHub repository, the `browser-translator-api` Worker (its name
is part of its deployed URL), and the floating UI's DOM id.
