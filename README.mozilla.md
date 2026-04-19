# Odysee Enhanced - Reviewer Build Notes

This repository contains the source code used to build the Firefox submission package for `Odysee Enhanced`.

Author: `cst8t`

## Build environment

- Node.js 24+
- npm 11+
- Linux/macOS shell tools for `zip`

## Install dependencies

```bash
npm ci
```

## Build the reviewer-friendly Firefox package

```bash
npm run build:firefox
```

This writes the extension package contents to `dist/` with readable bundled output.

## Validate the Firefox package

```bash
npm run check:firefox
```

## Create the AMO upload archive

```bash
npm run package:firefox
```

This packages the contents of `dist/` into `web-ext-artifacts/`.

## Create the source archive

```bash
npm run package:source
```

This creates `web-ext-artifacts/odysee-enhanced-extension-source.zip` containing the original source, build scripts, lockfile, and this reviewer note.

## Build details

- `build.mjs` bundles `src/content-script.js` with `esbuild`
- `src/content.css`, `manifest.json`, and `icons/` are copied directly into `dist/`
- `src/icons.js` imports the exact Phosphor SVG assets used in the extension, and `esbuild` inlines them into the bundled script
