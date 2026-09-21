# FlickOS website

Marketing site and documentation for [FlickOS](https://github.com/dvbondoy/FlickOS), built with [Astro](https://astro.build/), [Starlight](https://starlight.astro.build/), and Tailwind CSS v4.

- **Site:** https://flickos.net
- **Product repo:** sibling checkout at `../flickos` (not a submodule)

## Develop

Requires Node.js 22.12+.

```sh
npm install
npm run sync-docs   # vendors ../flickos/docs into src/content/docs/docs
npm run dev
```

```sh
npm run build
npm run preview
```

Set `FLICKOS_DOCS_PATH` if the product repo is not at `../flickos`.

## Deploy

Static output (`dist/`). Vercel detects Astro automatically — no adapter required.
