#!/usr/bin/env python3
"""Measure the variety system on a production export.

Reads two CSV exports (semicolon-separated, kept OUT of the repository -
they are production data) from EXPORT_DIR:

  stones.csv  legacy_type;legacy_shade;stones
      SELECT t.code AS legacy_type, coalesce(sh.code,'') AS legacy_shade,
             count(*) AS stones
      FROM pdp_stone s JOIN pdp_stone_type t ON t.id = s.type_id
      LEFT JOIN pdp_stone_shade sh ON sh.id = s.shade_id
      GROUP BY 1, 2 ORDER BY 1, 2

  lines.csv   product_id;model_id;metal;legacy_type;legacy_shade;weight;
              shape;size;pieces
      SELECT p.id AS product_id, p.model_id, coalesce(p.metal,'') AS metal,
             t.code AS legacy_type, coalesce(sh.code,'') AS legacy_shade,
             coalesce(nullif(ps.reshaped_weight,0), ps.weight, 0) AS weight,
             coalesce(sp.code,'') AS shape, coalesce(sz.name,'') AS size,
             ps.pieces
      FROM pdp_product p
      JOIN pdp_product_stone ps ON ps.composition_id = p.stone_composition_id
      JOIN pdp_stone s ON s.id = ps.stone_id
      JOIN pdp_stone_type t ON t.id = s.type_id
      LEFT JOIN pdp_stone_shade sh ON sh.id = s.shade_id
      LEFT JOIN pdp_stone_shape sp ON sp.id = s.shape_id
      LEFT JOIN pdp_stone_size sz ON sz.id = s.size_id

  products.csv  product_id;code;legacy_code   (optional)
      SELECT id AS product_id, code, coalesce(legacy_code,'') AS legacy_code
      FROM pdp_product WHERE stone_composition_id IS NOT NULL

and writes only aggregates next to the curated CSVs:

  data/variety.usage.csv    stones and product lines per legacy pair
  data/variety.metrics.json variant indexes for the proposal (the 'axes'
                            column of variety.family.csv) and for every
                            alternative choice of each family
  data/variety.written.csv  how today's product codes write each type +
                            shade: share of products writing the type alone
                            (or an abbreviation of it, AM for AME), share
                            writing type + shade, and the usual forms

Products of one model sharing the same varieties are told apart by a
VARIANT INDEX at the end of their code: their distinct stone contents
(stones, shapes, sizes, counts) are numbered in creation order, the first
one without index; the same stones in another metal keep their number.
Products identical to another (same model, metal and stones) share their
code whatever the rule: they are counted as duplicates.

Usage: python3 tools/usage.py EXPORT_DIR [--suggest]
  --suggest also prints, per family, the products each axis spares an
            index - the evidence behind the 'axes' column.
"""
import collections
import csv
import itertools
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
AXES = ('colour', 'grade', 'treatment', 'effect')
LETTER = {'colour': 'c', 'grade': 'g', 'treatment': 't', 'effect': 'e'}


def read(path, delimiter=','):
    with open(path, newline='', encoding='utf-8') as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def colour_tokens(code):
    """The stone tokens of a product code MODEL-STONES/METAL."""
    body = code.split('-', 1)[1] if '-' in code else ''
    body = re.sub(r'\([^)]*\)', '', body.rsplit('/', 1)[0].upper())
    return [t.strip() for t in body.split('+') if t.strip()]


def written_today(export, pairs_of):
    """How product codes write each type + shade today."""
    codes = {r['product_id']: r['legacy_code'] or r['code']
             for r in read(export / 'products.csv', ';')}
    products = collections.Counter()
    bare = collections.Counter()
    full = collections.Counter()
    forms = collections.defaultdict(collections.Counter)
    for pid, pairs in pairs_of.items():
        tokens = colour_tokens(codes.get(pid, ''))
        for t, s in pairs:
            products[(t, s)] += 1
            if any(len(k) >= 2 and t.startswith(k) for k in tokens):
                bare[(t, s)] += 1
            if s and t + s in tokens:
                full[(t, s)] += 1
        # the usual forms: products whose stones are this pair alone
        # (white diamonds aside, they accompany everything)
        rest = pairs - {('DTS', 'W1')} or pairs
        if len(rest) == 1:
            others = [k for k in tokens if k not in ('DTS', 'DT', 'D')]
            forms[next(iter(rest))][' + '.join(others) or 'DTS'] += 1
    rows = []
    for pair in sorted(products):
        n = products[pair]
        seen = forms[pair]
        total = sum(seen.values())
        usual = '; '.join(f'{k} {round(100 * v / total)}%' for k, v in seen.most_common(3)) if total else ''
        rows.append([*pair, n, round(bare[pair] / n, 3), round(full[pair] / n, 3), usual])
    with open(DATA / 'variety.written.csv', 'w', newline='', encoding='utf-8') as handle:
        out = csv.writer(handle, lineterminator='\n')
        out.writerow(['legacy_type', 'legacy_shade', 'products', 'bare', 'full', 'forms'])
        out.writerows(rows)


def main(export, suggest):
    legacy = {(r['legacy_type'], r['legacy_shade']): r
              for r in read(DATA / 'variety.legacy.csv')}
    families = read(DATA / 'variety.family.csv')
    proposal = {f['id']: frozenset(f['axes'].split()) for f in families}

    stones = {(r['legacy_type'], r['legacy_shade']): int(r['stones'])
              for r in read(export / 'stones.csv', ';')}
    lines_per_pair = collections.Counter()
    pairs_of = collections.defaultdict(set)
    lines_of = collections.defaultdict(list)
    where = {}
    for r in read(export / 'lines.csv', ';'):
        pair = (r['legacy_type'], r['legacy_shade'])
        lines_per_pair[pair] += 1
        pairs_of[r['product_id']].add(pair)
        lines_of[r['product_id']].append(r)
        where[r['product_id']] = (r['model_id'], r['metal'])
    unknown = (set(stones) | set(lines_per_pair)) - set(legacy)
    if unknown:
        sys.exit(f'legacy pairs missing from variety.legacy.csv: {sorted(unknown)}')

    with open(DATA / 'variety.usage.csv', 'w', newline='', encoding='utf-8') as handle:
        out = csv.writer(handle, lineterminator='\n')
        out.writerow(['legacy_type', 'legacy_shade', 'stones', 'lines'])
        for pair in sorted(legacy):
            out.writerow([*pair, stones.get(pair, 0), lines_per_pair.get(pair, 0)])

    if (export / 'products.csv').exists():
        written_today(export, pairs_of)

    # each product: its model, its stones (legacy pairs) and its full content
    content = {pid: tuple(sorted((r['legacy_type'], r['legacy_shade'], r['shape'], r['size'], r['pieces'])
                                 for r in rows)) for pid, rows in lines_of.items()}
    products = sorted(pairs_of, key=int)  # creation order
    product_pairs = [tuple(pairs_of[p]) for p in products]
    product_model = [where[p][0] for p in products]
    product_content = [content[p] for p in products]
    default = {f['id']: f['default_colour'] for f in families}

    def indexes(config):
        """config: family -> set of written axes. Variant index statistics."""
        key = {}
        for pair, row in legacy.items():
            written = config.get(row['family'], frozenset())
            values = []
            for axis in AXES:
                value = row[axis] if axis in written else None
                if axis == 'colour' and value == '' and default[row['family']]:
                    value = default[row['family']]
                values.append(value)
            key[pair] = (row['family'], *values)
        scopes = collections.defaultdict(dict)
        index = []
        for model, pairs, stones in zip(product_model, product_pairs, product_content):
            scope = scopes[(model, frozenset(key[p] for p in pairs))]
            index.append(scope.setdefault(stones, len(scope) + 1))
        return {'indexed': sum(1 for i in index if i > 1), 'max': max(index),
                'over9': sum(1 for i in index if i > 9),
                'models_over9': len({m for m, i in zip(product_model, index) if i > 9})}

    # axes a family can write: at least two values in real use
    applicable = {}
    for f in families:
        rows = [r for pair, r in legacy.items()
                if r['family'] == f['id'] and lines_per_pair.get(pair)]
        applicable[f['id']] = [axis for axis in AXES
                               if len({r[axis] for r in rows}) > 1]

    twins = collections.Counter(zip(product_model, (where[p][1] for p in products), product_content))
    base = indexes(proposal)
    metrics = {
        'products': len(products),
        'lines': sum(lines_per_pair.values()),
        'duplicates': sum(n for n in twins.values() if n > 1),
        'family_only': indexes({}),
        'every_axis': indexes({f['id']: frozenset(AXES) for f in families}),
        'proposal': base,
        'families': {},
    }
    for f in families:
        fid = f['id']
        axes = applicable[fid]
        options = {}
        for n in range(len(axes) + 1):
            for combo in itertools.combinations(axes, n):
                stats = indexes({**proposal, fid: frozenset(combo)})
                options[''.join(LETTER[a] for a in combo)] = {
                    'indexed': stats['indexed'] - base['indexed'], 'max': stats['max']}
        metrics['families'][fid] = {
            'lines': sum(lines_per_pair.get(pair, 0) for pair, r in legacy.items()
                         if r['family'] == fid),
            'axes': [LETTER[a] for a in axes],
            'options': options,
        }
    with open(DATA / 'variety.metrics.json', 'w', encoding='utf-8') as handle:
        json.dump(metrics, handle, indent=1, sort_keys=True)
        handle.write('\n')
    print(f"{metrics['products']} products, {metrics['duplicates']} duplicates; indexed: "
          f"family only {metrics['family_only']['indexed']}, proposal {base['indexed']} "
          f"(largest {base['max']}), every axis {metrics['every_axis']['indexed']}")

    if suggest:
        print('\nper family: products each axis spares an index (the rest as proposed)')
        for f in families:
            fid = f['id']
            found = []
            for axis in applicable[fid]:
                options = metrics['families'][fid]['options']
                chosen = ''.join(LETTER[a] for a in AXES if a in proposal[fid] and a in applicable[fid])
                without = chosen.replace(LETTER[axis], '')
                with_axis = ''.join(LETTER[a] for a in AXES
                                    if LETTER[a] in without + LETTER[axis])
                spared = options[without]['indexed'] - options[with_axis]['indexed']
                found.append(f"{axis} {spared}{' (written)' if axis in proposal[fid] else ''}")
            if found:
                print(f"  {fid:18} {', '.join(found)}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), '--suggest' in sys.argv[2:])
