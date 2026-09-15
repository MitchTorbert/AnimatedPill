import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { contrastTextColor } from "./colors";
import motion from "./pill-motion.json";

export interface PillProps {
  username: string;
  colorHex: string;
}

// Everything below was measured directly from a real rendered deliverable
// ("GalaxyAUS Pill Blood.mov") by decoding its actual RGBA pixels frame-by-frame -
// not read from the AEP or reconstructed from keyframes.
const FONT_SIZE = 139; // calibrated against real measured text widths across 4 reference renders
const PADDING_TOTAL = 225; // pillWidth - textWidth at rest, averaged across 4 reference renders (223-227px)
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

function sample(arr: number[], frame: number): number {
  const clamped = Math.max(0, Math.min(arr.length - 1, Math.round(frame)));
  return arr[clamped];
}

let measureCanvas: HTMLCanvasElement | null = null;
function measureText(text: string): { width: number; ascent: number } {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d")!;
  ctx.font = `500 ${FONT_SIZE}px RoobertTWITCH`;
  const m = ctx.measureText(text);
  return { width: m.width, ascent: m.actualBoundingBoxAscent };
}

export const Pill: React.FC<PillProps> = ({ username, colorHex }) => {
  const frame = useCurrentFrame();
  const { width: compWidth } = useVideoConfig();

  const label = `/${username}`;
  const textColor = contrastTextColor(colorHex);

  const { width: textWidth, ascent } = measureText(label);
  const restWidth = textWidth + PADDING_TOTAL;

  // --- pill background: width scales from the measured curve; height/vertical
  // position are absolute and username-independent (constant across every
  // reference render regardless of text length or descenders) ---
  const widthScale = sample(pillWidthScale, frame);
  const curWidth = restWidth * widthScale;
  const curTop = sample(pillTop, frame);
  const curBottom = sample(pillBottom, frame);
  const curHeight = Math.max(2, curBottom - curTop);
  const centerX = compWidth / 2;

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
  const framesPastReliable = Math.max(0, frame - LAST_RELIABLE_TEXT_FRAME);
  let lateExtrapolation = 0;
  let compoundingDelta = lastRealDelta;
  for (let i = 0; i < framesPastReliable; i++) {
    compoundingDelta *= EXIT_ACCELERATION;
    lateExtrapolation += compoundingDelta;
  }
  const trackedTextTop =
    frame > LAST_RELIABLE_TEXT_FRAME
      ? sample(textTop, LAST_RELIABLE_TEXT_FRAME) + lateExtrapolation
      : sample(textTop, frame);
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
        {frame >= FIRST_TEXT_FRAME && (
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
