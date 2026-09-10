# Gemstone Notation

A compact, separator-free notation for gemstones and for the colour code
of a finished jewellery product — as a **static website**: no server, no
database, no dependency. Open `index.html` in a browser, or serve the
folder anywhere (GitHub Pages works out of the box).

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
index.html            the site (open it, that's all)
assets/grammar.js     the grammar engine (browser + node, no deps)
assets/data.js        the dictionaries (generated - do not edit)
assets/app.js         page behaviour
data/*.csv            source of truth for the dictionaries
tools/build_data.py   regenerates assets/data.js from data/*.csv
tests/grammar.test.js node --test suite mirroring the reference module
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
