# Anatomy of Gi

Interactive isometric figures that explain how [Gi](https://github.com/IAFahim/grid-influence)
— sparse tiled integer influence fields for .NET — actually works.

Every figure is a machine you can work: move a die, follow a branch, watch a
publish cycle. Every number they show is produced by a model of the library,
not drawn by hand.

| | figure | what it explains |
| --- | --- | --- |
| Fig 1 | [The field bench](site/figures/field-bench.html) | the change-rate deposit cycle: a source is a column and a mark on a changed list, and only the touched tiles are republished |
| Fig 2 | [The pyramid](site/figures/pyramid.html) | how a query finds the best cell of a 1024² field without scanning it |
| Fig 3 | [The planes](site/figures/planes.html) | the four planes a tile owns, and how they are summed into published cells |
| Fig 4 | [The balance](site/figures/balance.html) | derived layers: a formula over other layers, maintained only where its inputs changed |

Open `site/index.html` in a browser, or read it online at the published URL.

## The rules these figures follow

- **The numbers are the library's.** The seven kernels in `build/model/model.mjs`
  are fixed-point ports of Gi's own arithmetic and are bit-exact against the
  dumps in Gi's README. The field semantics in `build/model/field.mjs` are
  asserted by `build/model/test-field.mjs`.
- **The drawing is proved, not eyeballed.** `node build/build.mjs` runs the
  Anatomy kit's audit on every figure: nothing floats, nothing passes through
  anything, no end of a line is in mid-air, and every overlap is drawn in
  depth order.
- **One lit thing per figure.** The lit part is the one that matters, and the
  rest of the drawing is four tones of grey.

## Build

```sh
node build/build.mjs            # every figure and the index
node build/build.mjs --shots    # also capture the preview images
node build/model/test-field.mjs # the truth model against Gi's semantics
```

Each figure is a standalone HTML document with its CSS and scripts inlined, so
it opens from disk and deploys as a flat static site. `site/` is the built
output and is committed, so the site can be served straight from the repository.

```
build/
  site.mjs        the shared page shell, the figure list, the site CSS
  fig-bench.mjs   Fig 1
  fig-pyramid.mjs Fig 2
  fig-planes.mjs  Fig 3
  fig-balance.mjs Fig 4
  index.mjs       the map of the algorithm
  model/          the truth: kernels, the field, the pyramid, the planes
kit/              the Anatomy kit (MIT, vendored — see kit/LICENSE)
tools/            the kit's audit, capture, drive and line-end tools
site/             the built site
```

## The kit

The figures are built with the [Anatomy](https://github.com/wheresryan22/anatomy)
skill's kit: a small isometric drawing library with a strict audit. It is MIT
licensed and vendored under `kit/` with its own licence, so this repository
builds without the skill installed.

## Licence

MIT, see `LICENSE`. The vendored kit keeps its own MIT licence in `kit/LICENSE`.
