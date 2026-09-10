# Gemstone Notation

A compact, separator-free notation for gemstones and for the colour code
of a finished jewellery product — as a **static website**: no server, no
database, nothing to install. Open `index.html` in a browser, or serve the
folder anywhere (GitHub Pages works out of the box). The only third-party
code is three.js, for the 3D page, vendored as one file.

The site carries the full reference dictionaries — 112 stones with their
categories and defaults, 7 grades, 91 hues, 178 shapes — and the grammar
engine, so you can compose a code from a stone's components, read a code
back into its components, build a product colour code, and browse the
dictionaries.

## The token grammar: `PP[G][HH][SS]`

| Block | Width | Characters | Meaning |
|-------|-------|------------|---------|
| `PP`  | 2     | letters | stone identity |
| `G`   | 1     | digit | quality grade |
| `HH`  | 2     | digit **then** letter | hue |
| `SS`  | 2     | letters | cutting shape |

Examples: `SA` (sapphire, everything default), `SA2` (grade 2), `SA1C`
(hue Ceylon), `SA21CPS` (grade 2, Ceylon, pear).

**Why no separators are needed** — the widths and character classes were
chosen so that at most one way of splitting the part after `PP` is
structurally valid: a lone digit can only be a grade, a digit followed by
a letter can only start a hue, letters can only be a shape. The parser
enumerates the eight width combinations and accepts a token only when
exactly one survives.

**Defaults keep codes short** — each stone declares a default grade, hue
and shape, determined from occurrence counts in a real production
history; a block equal to the default is omitted, so the most frequent
stones write in two characters.

**Colour-bearing stones** (Blue Topaz...) declare an *implied hue*:
their tokens never write that hue, and writing a different one is
refused as a double colour.

**A product's colour code** joins the distinct stone tokens with `+`:
center stone first, then heaviest single stone descending, ties broken
by token.

## Repository layout

```
index.html                 the site (open it, that's all)
study.html                 the design study
shape3d.html               the 3D shapes page
assets/grammar.js          the grammar engine (browser + node, no deps)
assets/data.js             the dictionaries (generated - do not edit)
assets/app.js              page behaviour
assets/combo.js            the searchable dropdown shared by the pages
assets/shape3d.js          the 3D shape generator (browser + node, no deps)
assets/shape3d-recipes.js  shape code -> outline + cut + overrides
assets/shape3d-render.js   the 3D viewer and STL / GLB export (three.js)
assets/shape3d-page.js     3D page behaviour
assets/vendor/three.js     three.js + addons as one script (generated)
data/*.csv                 source of truth for the dictionaries
tools/build_data.py        regenerates assets/data.js from data/*.csv
tools/three/               rebuilds assets/vendor/three.js
tests/*.test.js            node --test suites
```

## 3D shapes

Composing a code on the workspace shows the stone turning in a small
3D preview — the chosen shape, else the stone's default one, with no
parameter to set. `shape3d.html` is the full version, where every
parameter can be adjusted.

No database holds the trade shapes, so the site **generates** each
stone from parameters. A stone is an **outline** — the girdle seen from
above: round, oval, pear, marquise, heart, cushion, octagon, trillion,
kite, half moon, star… — crossed with a **top** and a **bottom** half
joined by the girdle band. Seven half styles cover the cuts:

| Style | Makes |
|-------|-------|
| brilliant | table, stars, bezels, upper girdles / lower girdles, mains — the 57 classic facets on a round |
| step | rows parallel to the outline; a rectangular pavilion ends in a keel |
| single, French | one facet per main; a table turned 45° |
| rose | a dome of triangular facets (rose cuts, briolettes, faceted beads) |
| dome | smooth: cabochons, buff tops, beads, drops |
| flat | tablets and disks, with a small bevel |

Every measure is relative to the width (= 1), like gemological
proportions: a crown height of `0.15` is 15 % of the width. A shape code
is only a recipe in `assets/shape3d-recipes.js` — an outline, a cut preset
(`GemShape3D.CUTS`) and optional overrides — so every parameter stays
adjustable on the page; "Copy parameters" gives the JSON of a design,
ready to paste back as a recipe. Shapes without a recipe (house
references A120…, carvings, mixes, strands) show as "no model yet".
The mesh is shape only; materials and optics are a later step.

The page exports the stone at a chosen width in millimetres: STL (mm,
Z up) for CAD and printing, GLB (metres, Y up) for 3D viewers.

The generator (`assets/shape3d.js`) knows nothing of three.js; the viewer
draws with it. three.js is bundled into a plain script (`window.THREE`)
rather than loaded as ES modules, which browsers refuse from `file://`.
To upgrade it or add an addon, edit `tools/three/entry.js`, then:

```
cd tools/three && npm install && npm run build
```

## Editing the dictionaries

Edit the CSVs in `data/`, then:

```
python3 tools/build_data.py
node --test tests/
```

## Deploying

Any static hosting. For GitHub Pages: repository **Settings → Pages →
Deploy from a branch → `main` / root** — the site is then served at
`https://<owner>.github.io/gem_notation/`.

## Relation to the Odoo module

The same notation ships as a standalone Odoo 18 module (`gem_notation`)
carrying these exact dictionaries; this site is the zero-install way to
consult and use the notation. The CSVs are interchangeable between the
two.
