# Pixel Art Paint

Pixel Art Paint is a browser-based pixel art editor built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, and Feature-Sliced Design.

The project is focused on a desktop-style drawing workflow: layers, selection, transform controls, reference images, zoom and pan, customizable panels, and quick export to PNG.

## Features

- Drawing tools: pencil, eraser, fill, selection, rectangle, ellipse
- Straight line while holding `Shift`
- Undo with `Ctrl/Cmd + Z`
- Cut, copy, paste selection with `Ctrl/Cmd + X`, `Ctrl/Cmd + C`, `Ctrl/Cmd + V`
- Multi-layer workflow with add, remove, hide/show, rename on double click or `F2`
- Layer transform with `Ctrl`: move, scale, rotate
- Keep proportions while scaling with `Ctrl + Shift`
- Canvas resize with optional aspect ratio lock
- Zoom with trackpad, `Ctrl` + wheel, and bottom zoom slider
- Pan with `Space + drag`
- Reference image overlay with visibility and opacity controls
- Mini preview of the whole canvas
- Palette with built-in colors and custom color adding
- PNG export with save location picker when supported by the browser
- Rearrangement of editor panels and tool docking between left, center, and right areas

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
```

## Usage Notes

- The center toolbar for tools is hidden by default and appears when the tools block is moved there.
- The canvas settings panel contains canvas size controls and aspect lock.
- Zoom is controlled from the bottom bar under the canvas.
- Export uses the File System Access API when available; otherwise it falls back to browser download.

## Current Scope

This repository currently focuses on the editor itself and local image export. It does not yet include:

- project file save/load
- redo history
- animation timeline
- backend synchronization

## Known State

The editor functionality described above is implemented in the app. At the same time, the repository still contains some older files and TypeScript issues outside the main current flow, so `npm run build` may require additional cleanup before passing without errors.

## License

MIT
