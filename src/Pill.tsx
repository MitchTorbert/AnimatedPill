import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { contrastTextColor } from "./colors";
import motion from "./pill-motion.json";

export interface PillProps {
  username: string;
  colorHex: string;
  // Optional: lay the pill out around a horizontal center other than the comp's own
  // midpoint (used by PillWithAmbassador.tsx to place it beside the ambassador badge).
  // Omitted, this is pixel-identical to the standalone pill - nothing else changes.
  centerXOverride?: number;
  // Optional export frame rate (23.976/30/60). Every measured curve below and every
  // frame-number constant is authored against the original 30fps reference footage -
  // components convert their own useVideoConfig().fps into a "reference frame" via
  // REFERENCE_FPS before touching any of it, so this prop only affects Root.tsx's
  // calculateMetadata (which sets the real fps/duration); components never read it
  // directly. Omitted, this is pixel-identical to a plain 30fps render.
  fps?: number;
}

// Every measured curve in pill-motion.json and every frame-number constant in this
// file were captured against a 30fps reference render - see REFERENCE_FPS below.
export const REFERENCE_FPS = 30;

// Everything below was measured directly from a real rendered deliverable
// ("GalaxyAUS Pill Blood.mov") by decoding its actual RGBA pixels frame-by-frame -
// not read from the AEP or reconstructed from keyframes.
export const FONT_SIZE = 139; // calibrated against real measured text widths across 4 reference renders
export const PADDING_TOTAL = 225; // pillWidth - textWidth at rest, averaged across 4 reference renders (223-227px)
// Real footage has zero text pixels before this frame (verified against the raw, unfilled
// pixel data) - frames before it are filled with a held constant for the position math to
// stay well-defined, but must not actually be rendered, or text appears to sit statically
// during the pill's pre-motion hold.
const FIRST_TEXT_FRAME = 8;
// Pixel tracking became too noisy to trust past this frame (text was down to a few px),
// NOT the frame text actually stops moving - past it we keep the slide going by tracking
// the pill's own (already-verified) continued collapse, so text and pill shrink together
// instead of text freezing mid-exit while the pill keeps closing around it.
const LAST_RELIABLE_TEXT_FRAME = 150;

const { restPillWidthPx, restTextTopY, pillWidthScale, pillTop, pillBottom, textTop } = motion as {
  restPillWidthPx: number;
  restTextTopY: number;
  pillWidthScale: number[];
  pillTop: number[];
  pillBottom: number[];
  textTop: number[];
};

// Linearly interpolates between the two nearest measured samples. At 30fps `frame`
// is always a whole number, so this reduces to an exact lookup (byte-identical to
// the old nearest-neighbor version) - it only actually interpolates for the
// in-between reference-frame positions that 60fps/23.976fps land on.
export function sample(arr: number[], frame: number): number {
  const clamped = Math.max(0, Math.min(arr.length - 1, frame));
  const lower = Math.floor(clamped);
  const upper = Math.min(arr.length - 1, lower + 1);
  const t = clamped - lower;
  return arr[lower] + (arr[upper] - arr[lower]) * t;
}

let measureCanvas: HTMLCanvasElement | null = null;
export function measureText(text: string): { width: number; ascent: number } {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d")!;
  ctx.font = `500 ${FONT_SIZE}px RoobertTWITCH`;
  const m = ctx.measureText(text);
  return { width: m.width, ascent: m.actualBoundingBoxAscent };
}

// Rest (fully-settled) pill height - constant regardless of username, matches the
// hold-frame measurement (frame 13) baked into pill-motion.json.
export const REST_PILL_HEIGHT = pillBottom[13] - pillTop[13];

// Shared layout math also used by PillWithAmbassador.tsx to know where the username
// pill will be at a given frame, so it can place the ambassador badge beside it.
export function getPillMetrics(username: string, frame: number) {
  const label = `/${username}`;
  const { width: textWidth } = measureText(label);
  const restWidth = textWidth + PADDING_TOTAL;
  const widthScale = sample(pillWidthScale, frame);
  const curWidth = restWidth * widthScale;
  const curTop = sample(pillTop, frame);
  const curBottom = sample(pillBottom, frame);
  const curHeight = Math.max(2, curBottom - curTop);
  return { restWidth, curWidth, curTop, curBottom, curHeight };
}

export const Pill: React.FC<PillProps> = ({ username, colorHex, centerXOverride }) => {
  const frame = useCurrentFrame();
  const { width: compWidth, fps } = useVideoConfig();
  // Every measured curve and frame-number constant below is authored against the
  // 30fps reference footage - converting the actual playback frame into that
  // reference timeline is the one change needed to support other export frame
  // rates. At 30fps this is just `frame` unchanged.
  const refFrame = (frame * REFERENCE_FPS) / fps;

  const label = `/${username}`;
  const textColor = contrastTextColor(colorHex);
  const { ascent } = measureText(label);

  // --- pill background: width scales from the measured curve; height/vertical
  // position are absolute and username-independent (constant across every
  // reference render regardless of text length or descenders) ---
  const { restWidth, curWidth, curTop, curBottom, curHeight } = getPillMetrics(username, refFrame);
  const centerX = centerXOverride ?? compWidth / 2;

  // --- text: a rigid block (real font baseline via SVG, not hand-guessed CSS line-box
  // math) that slides vertically using the measured top-edge curve, clipped ONLY by the
  // pill's own already-verified boundary. The pill being small/growing early on and
  // shrinking on exit is what naturally produces the "enters from below / exits through
  // the top, matted by the pill" look - no separate reveal-window needed. ---
  const restBaselineY = restTextTopY + ascent; // top-edge is descender-independent, so this is stable
  // Past the point where direct pixel tracking got too noisy to trust, continue the text's
  // OWN exit motion on its own pace rather than tying it to either pill edge - the measured
  // real data shows its per-frame delta accelerating ~1.75x each frame right up to that
  // point (-1,-1,-2,-2,-5,-8,-13,-23), so keep compounding that same acceleration. This
  // clears the frame well before the (slower) pill collapse finishes, matching reference.
  const lastRealDelta =
    sample(textTop, LAST_RELIABLE_TEXT_FRAME) - sample(textTop, LAST_RELIABLE_TEXT_FRAME - 1);
  const EXIT_ACCELERATION = 1.75;
  const framesPastReliable = Math.max(0, refFrame - LAST_RELIABLE_TEXT_FRAME);
  // Closed-form geometric sum of lastRealDelta*(ACCEL^1 + ACCEL^2 + ... + ACCEL^n) -
  // equivalent to compounding a loop n times, but also well-defined for the
  // fractional n that 60fps/23.976fps reference-frame math produces.
  const lateExtrapolation =
    (lastRealDelta * EXIT_ACCELERATION * (Math.pow(EXIT_ACCELERATION, framesPastReliable) - 1)) /
    (EXIT_ACCELERATION - 1);
  const trackedTextTop =
    refFrame > LAST_RELIABLE_TEXT_FRAME
      ? sample(textTop, LAST_RELIABLE_TEXT_FRAME) + lateExtrapolation
      : sample(textTop, refFrame);
  const slideDelta = trackedTextTop - restTextTopY;
  const baselineY = restBaselineY + slideDelta;

  return (
    <AbsoluteFill>
      {/* Pill background */}
      <div
        style={{
          position: "absolute",
          left: centerX - curWidth / 2,
          top: curTop,
          width: curWidth,
          height: curHeight,
          borderRadius: curHeight / 2,
          background: colorHex,
        }}
      />

      {/* Text, clipped by the pill's own boundary only */}
      <div
        style={{
          position: "absolute",
          left: centerX - curWidth / 2,
          top: curTop,
          width: curWidth,
          height: curHeight,
          borderRadius: curHeight / 2,
          overflow: "hidden",
        }}
      >
        {refFrame >= FIRST_TEXT_FRAME && (
          <svg
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
            width={curWidth}
            height={curHeight}
          >
            {/* Text sits at a fixed horizontal position (centered on the RESTING width,
                never the currently-animating one) - only vertical motion, no lateral drift
                as the pill grows/shrinks. The pill's own (narrower) clip still crops it
                from the sides during entrance/exit, same as it crops vertically. */}
            <text
              x={curWidth / 2 - restWidth / 2 + PADDING_TOTAL / 2}
              y={baselineY - curTop}
              fontFamily="RoobertTWITCH"
              fontSize={FONT_SIZE}
              fontWeight={500}
              fill={textColor}
            >
              {label}
            </text>
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};
