# Stone Varieties

How to describe the stones of a jewellery production and write them in
product codes — as a **static website**: no server, no database, nothing
to install. Open `index.html` in a browser, or serve the folder anywhere
(GitHub Pages works out of the box). The only third-party code is
three.js, for the 3D views, vendored as one file.

## The variety system

1. **Every stone is described in full**: family (Sapphire, Topaz,
   Diamond…), colour, grade, treatment and effect — plus shape and size for
   the stock. Each family lists the values it accepts: Blue Topaz is Topaz
   + Blue (so it keeps its grade), Reconstructed exists for turquoise, not
   for sapphire.
2. **The code tells the stone and its colour**, and little more: each
   family writes its colour wherever several are in use, except its
   **default colour** (a diamond is white unless told otherwise: `DTS` is
   the white diamond, `DTSBR` the brown one); the grade only where today's
   product codes already write it (sapphire `SAPL`, topaz `BTA`, citrine
   `CITA`, ruby and emerald `RU2`, `EM2`). Tones can be written
   `A · AA · AAA · AAAA` as in the stock codes, `1A · 2A · 3A · 4A`, or
   `A · 2A · 3A · 4A` as product codes mostly write them today; a switch on
   the page picks the writing, and a code reads in any of them.
3. **Every variety keeps today's code** — the stock code, type then shade,
   that everyone already reads — without what the family does not write
   (Peridot is `PER` whatever its grade). Stones that were the same thing
   under two codes take the most used one. A combination never seen before
   is written with today's pieces (`TOPPK`, a pink topaz) and flagged, or
   marked to be named when no piece exists.
4. **A product code** is the model, its varieties — center stone first,
   then heaviest single stone — and the metal: `R1048-SAPM+DTS/W`.
5. **A variant index settles the rest**: products of one model with the
   same codes but other stones (another grade, size or count) are numbered
   in creation order, the first without index — `R1048-SAPM+DTS/W-2`; the
   same stones in another metal keep their number. Measured: 8 % of
   products carry an index, 99.5 % stay at 3 or less.

The page lets you describe a stone and get its variety, build and read
product codes, tick what each family writes and see the effect on the
number of varieties, the code length and the variant indexes, and check
how each of today's stone codes (type + shade) reads into the new
description.

### Data

| File | Kind | Content |
|------|------|---------|
| `data/variety.family.csv` | curated | families, today's types they absorb, the axes their code writes, their default colour |
| `data/variety.colour.csv`, `.grade.csv`, `.treatment.csv`, `.effect.csv` | curated | the value dictionaries (grades carry their scale: tone, quality, clarity, Kanchana) |
| `data/variety.legacy_type.csv`, `.legacy_shade.csv` | curated | what each of today's types and shades says (Blue Topaz: Topaz + Blue; PL: Pink + Light) — the vocabulary codes are written with |
| `data/variety.legacy.csv` | curated | every type + shade in use today → family, colour, grade, treatment, effect, with a status (ok, merged, to confirm, conflict) — a draft to validate |
| `data/variety.usage.csv` | generated | stones and product lines per type + shade (aggregates) |
| `data/variety.metrics.json` | generated | variant indexes for the proposal and for every alternative choice of each family (aggregates) |
| `data/variety.written.csv` | generated | how today's product codes write each type + shade (aggregates) |

The generated files come from a production export kept out of the
repository (the SQL is in `tools/usage.py`):

```
python3 tools/usage.py EXPORT_DIR   # add --suggest to see what each axis separates
python3 tools/build_data.py
node --test tests/
```

`assets/variety.js` is the variety engine (browser + node): varieties,
their codes, product codes, reading, variant index figures.

## The token notation (earlier design)

The site grew out of a compact, separator-free notation for gemstones and
for the colour code of a finished jewellery product. Its dictionaries —
112 stones with their categories and defaults, 7 grades, 91 hues, 178
shapes — and its grammar engine are still here: the 3D page and the stone
look use them, and the design study (`study.html`) documents the choice.

### The token grammar: `PP[G][HH][SS]`

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
study.html                 the design study of the token notation
shape3d.html               the 3D shapes page
assets/variety.js          the variety engine (browser + node)
assets/variety-data.js     the variety data (generated - do not edit)
assets/grammar.js          the token grammar engine (browser + node, no deps)
assets/data.js             the notation dictionaries (generated - do not edit)
assets/app.js              page behaviour
assets/combo.js            the searchable dropdown shared by the pages
assets/shape3d.js          the 3D shape generator (browser + node, no deps)
assets/shape3d-recipes.js  shape code -> outline + cut + overrides
assets/shape3d-render.js   the 3D viewer and STL / GLB export (three.js)
assets/shape3d-page.js     3D page behaviour
assets/stone-look.js       colour and material of each stone and hue
assets/gem-optics.js       light ray traced inside transparent stones
assets/vendor/three.js     three.js + addons as one script (generated)
data/*.csv                 source of truth for the dictionaries
tools/build_data.py        regenerates assets/data.js and variety-data.js
tools/usage.py             measures the variety system on a production export
tools/three/               rebuilds assets/vendor/three.js
tests/*.test.js            node --test suites
```

## 3D shapes

Composing a code on the workspace shows the stone turning in a small
3D preview — on the shape given, or on a reference shape suited to its
material when none is given — with no parameter to set. `shape3d.html` is the full version, where every
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

**Colour** (`assets/stone-look.js`) is a first approximation: every
stone has a reference colour and a material family (transparent,
translucent, opaque, pearl, metal) with its refractive index and
dispersion; every hue is a colour, a haze (Milky, Cloudy, White I1…), a
phenomenon (Star, White Cat) or has no colour defined yet. The colour
comes from the hue given, else the hue the stone implies, else the
stone's reference colour; a grade given as 1–4 sets its depth, 6–7 add
haze. As in the reading of a code, an omitted block may be the default
or simply not given, so the preview assumes neither: the notation's
defaults shorten codes, they are not facts about the stones.

**Light in transparent stones** (`assets/gem-optics.js`) is ray traced on
the GPU: the view ray refracts into the stone, bounces between the facets
(total internal reflection where the angle allows, Fresnel leakage
elsewhere) and is absorbed along its path, so the colour deepens with the
path as in a real cut stone; stones with fire (diamond, zircon,
moissanite…) are traced per colour channel. The facets are found with
three-mesh-bvh, bundled with three.js. The "light rays" switch on the 3D
page turns it off.

**Opaque and translucent stones** get their own shader: a procedural
texture in the stone's space — mottled (jade, jasper), veined (the matrix
of turquoise, amazonite), flecked (the pyrite and calcite of lapis),
rings (malachite, agate, rhodochrosite), stripes (tiger's eye, wood),
clouds (chalcedony, rose quartz) — polished or waxy; translucent stones
let light through where they are thin (jade glows at its edges); and
optical phenomena: cat's eye, star (the Star hues: a star sapphire turns
milky, as a real one is), adularescence (moonstone), play of colour
(opal), labradorescence, glitter (aventurine, sunstone, lapis).

On the workspace, when no shape is given — or the one given has no 3D
model yet — the stone turns on a reference shape suited to its material
(round brilliant, oval cabochon, ball, disk…), said as much under the
preview.

**Keeping it light** — without degrading the picture, still or moving
(the stone stays sharp while it is turned by hand):
- a ray stops bouncing once 98 % of its light is gone;
- the preview turns by itself at 30 frames a second, and stops when
  scrolled out of sight;
- a new stone's shader compiles in the background (the previous stone
  stays on screen, the page does not freeze); the facet search structure
  is built once per shape, not once per colour;
- curved stones use fewer triangles (smooth normals keep them round) and
  fewer bounces - light trapped along a curved wall adds nothing new -
  while faceted stones keep every bounce their brilliance is made of.

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

The variety system is not in the Odoo module yet: this site is where it is
presented and agreed on first. Its correspondence with today's stone codes
(`data/variety.legacy.csv`) is meant to become, once validated, the
migration table of the PDP stones.
