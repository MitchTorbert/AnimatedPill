# Animated Pill Generator

Local web app that recreates the animated pill tag from `00_Pills (converted).aep`. Pick one or more usernames and a brand color, get 2500x1080, 6-second, RGB+alpha ProRes 4444 `.mov` files — same drop-into-editor workflow as the AE exports, no After Effects required. Motion was measured directly from real rendered deliverables for an exact match, not an approximation.

## Using it

1. Double-click **`Start Pill Generator.command`** in this folder.
2. A Terminal window opens and, after a few seconds, your browser opens to the tool automatically. Leave that Terminal window open while you're using it — closing it shuts the app down.
3. Add a pill row per username. By default all pills share one color; check "Use a different color for each pill" to set them individually.
4. Pick an export size (30% / 35% / 50% / full resolution).
5. Click **Generate & Download**. One pill downloads directly as a `.mov`; multiple pills download together as a `Pills.zip` of separate `.mov` files, each named `{username} Pill {color}.mov`.

First render after starting is slower (~15-20s) while things warm up; after that, each pill takes ~10-15s to render (rendered one at a time, so a batch of 5 takes roughly 5x as long).

## Notes / assumptions baked into v1

- Solid-color pill only (no gradient or icon-inside variants yet)
- Text is always `/username` (the slash is fixed, not a toggle)
- Timing: 50f in / 90f hold / 40f out at 30fps (6.00s total)
- Text color auto-switches black/white for contrast against whatever pill color you pick
- Multiple pills always export as separate files (never composited together in one video)

## Editing the design

- `src/Pill.tsx` — the actual animation/composition (sizes, timing, easing)
- `src/pill-motion.json` — the measured motion curves `Pill.tsx` reads from
- `src/colors.ts` — the 32 brand colors, grouped by hue
- `server/index.ts` — render/zip API
- `server/public/index.html` — the web page itself
