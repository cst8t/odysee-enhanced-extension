# Odysee Enhanced

Firefox-first WebExtension for Odysee with quality-of-life video controls.

Current features:
- Theatre mode with dimmed background
- Hover-reveal control panel beneath the player
- Loop controls for full-video or partial-range looping

## Development

Install dependencies:

```bash
npm ci
```

Build the extension:

```bash
npm run build
```

Build a Firefox review package into `dist/`:

```bash
npm run build:firefox
```

Package the Firefox submission archive:

```bash
npm run package:firefox
```

Create the reviewer source archive:

```bash
npm run package:source
```

## Firefox Submission Notes

Reviewer-specific build and packaging details are in [`README.mozilla.md`](./README.mozilla.md).

Author: `cst8t`
