# Pixel Art Paint

Pixel Art Paint is a browser-based pixel art editor built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, and Feature-Sliced Design.

The project is focused on a desktop-style workflow for sprite drawing and animation: layers, selections, transform controls, animation frames, reference images, dockable panels, project save/load, and export tools.

## Features

- Drawing tools: pencil, eraser, fill, rectangle, ellipse, eyedropper, rectangular selection, smart selection
- Straight line drawing with `Shift`
- Undo with `Ctrl/Cmd + Z`
- Cut, copy, and paste selection with `Ctrl/Cmd + X`, `Ctrl/Cmd + C`, `Ctrl/Cmd + V`
- Multi-layer workflow with add, remove, hide/show, reorder, multi-select, and rename on double click or `F2`
- Layer transform with `Ctrl`: move, scale, rotate, horizontal and vertical flip
- Keep proportions while scaling with `Ctrl + Shift`
- Rotation snapping while holding `Shift`
- Canvas resize with optional aspect ratio lock
- Zoom with trackpad, wheel gestures, zoom slider, and centered canvas preview
- Pan with `Space + drag`
- Reference image overlay with visibility, opacity, scale, and move mode
- Palette presets, custom palettes, custom colors, palette reordering, and color editing
- Project save/load with File System Access API support when available
- Autosave into the active project file
- Animation timeline with frame add, duplicate, delete, reorder, onion skin, FPS control, and playback
- Export menu with single-frame PNG and animation sprite sheet export
- Rearrangement of editor panels and tool docking between left, center, and right areas
- English and Russian localization

## Hotkeys

- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + C`: copy selection
- `Ctrl/Cmd + X`: cut selection
- `Ctrl/Cmd + V`: paste selection
- `Shift`: draw a straight line with pencil or eraser
- `Ctrl`: move and transform active layer
- `Ctrl + Shift`: keep proportions during transform
- `Space + drag`: pan the viewport
- `F2`: rename active layer
- `Esc`: clear selection or close popup

Additional hotkeys are configurable from the settings popup.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React
- react-zoom-pan-pinch

## Project Structure

```text
src/
├── app/                  # app composition and providers
│   └── providers/
├── features/             # state and focused UI logic
│   ├── canvas/
│   ├── colors/
│   └── tools/
├── shared/               # shared types, utils, ui
│   ├── lib/
│   ├── types/
│   └── ui/
└── widgets/              # large editor widgets
    ├── canvas/
    ├── header/
    ├── settings/
    └── toolbar/
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

The app runs on [http://localhost:3000](http://localhost:3000).

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test:unit
```

## Testing

- `npm run test:unit` compiles and runs unit tests with the built-in `node:test` runner.
- The first test suite covers pure canvas helpers in `src/widgets/canvas/model/canvasUtils.ts`.

## Usage Notes

- The center toolbar for tools is hidden by default and appears when the tools block is moved there.
- The canvas settings panel contains canvas size controls and aspect lock.
- Zoom is controlled from the bottom bar under the canvas.
- Export uses the File System Access API when available; otherwise it falls back to browser download.
- The welcome screen supports creating a blank project, opening an existing project, using built-in templates, and reopening recent files.

## Current Scope

This repository currently focuses on the editor itself, local project workflows, and image export. It does not yet include:

- redo history
- backend synchronization
- collaboration or cloud sync
- marketplace, account system, or publishing flow
- mobile-first touch UX

## License

MIT
