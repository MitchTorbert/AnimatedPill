import React from "react";
import { CalculateMetadataFunction, Composition, staticFile, loadFont } from "remotion";
import { Pill, PillProps, measureText, PADDING_TOTAL, REST_PILL_HEIGHT, MAX_VERTICAL_OVERSHOOT } from "./Pill";
import { PillWithAmbassador, PillWithAmbassadorProps, AMBASSADOR_ASPECT, GAP } from "./PillWithAmbassador";

export const FPS = 30;
export const DURATION_IN_FRAMES = 180; // 6s: 50f in, 90f hold, 40f out
// Fallback size only - real exports size the canvas tightly around the actual
// pill (see calculateMetadata below), so these only show up in Studio before a
// username is typed.
export const COMP_WIDTH = 2500;
export const COMP_HEIGHT = 1080;
export const AMBASSADOR_COMP_WIDTH = 4000;
// Margin applied to all 4 sides equally, so the settled (resting) pill always
// stays centered in the canvas rather than being pushed off-center toward
// whichever edge needed more room. MAX_VERTICAL_OVERSHOOT covers the pill's
// own real entrance-animation overshoot (it doesn't overshoot horizontally -
// verified against the measured data), plus a small fixed buffer so the
// anti-aliased edge of its rounded corners never has a chance to clip either.
const MARGIN = MAX_VERTICAL_OVERSHOOT + 8;
// Export scale options are 0.3/0.35/0.5/1 - width/height need to stay a whole
// number of pixels after multiplying by any of those, or Remotion's stitcher
// rejects the render outright ("height must be an integer, but is 82.5", from
// a raw 275 * 0.3). 20 is the LCM of those scales' denominators, so rounding
// up to a multiple of it keeps every one of them an exact integer.
const SCALE_GRID = 20;
const roundUpToGrid = (n: number) => Math.ceil(n / SCALE_GRID) * SCALE_GRID;

// An export fps other than 30 changes the composition's real fps/duration (so the
// clip is still 6 real seconds) - everything else about the props is untouched.
// Pill.tsx/PillWithAmbassador.tsx convert their own playback frame back to the
// 30fps reference timeline, so no other metadata needs to change here. Width/height
// are sized tightly around the pill's own rest (maximum) size instead of a fixed
// oversized canvas - measureText needs the real RoobertTWITCH font, which is
// already guaranteed loaded by the delayRender in fonts.ts before this runs.
const calculateMetadata: CalculateMetadataFunction<PillProps> = ({ props, compositionId }) => {
  const fps = props.fps ?? FPS;
  const durationInFrames = Math.round((DURATION_IN_FRAMES * fps) / FPS);

  const { width: textWidth } = measureText(props.username ?? "");
  const restWidth = textWidth + PADDING_TOTAL;
  const height = roundUpToGrid(Math.ceil(REST_PILL_HEIGHT) + MARGIN * 2);

  if (compositionId === "PillWithAmbassador") {
    const restAmbWidth = REST_PILL_HEIGHT * AMBASSADOR_ASPECT;
    const pairWidth = restWidth + GAP + restAmbWidth;
    return { fps, durationInFrames, width: roundUpToGrid(Math.ceil(pairWidth) + MARGIN * 2), height };
  }

  return { fps, durationInFrames, width: roundUpToGrid(Math.ceil(restWidth) + MARGIN * 2), height };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Pill"
        component={Pill}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{
          username: "stableronaldo",
          colorHex: "#000000",
        }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id="PillWithAmbassador"
        component={PillWithAmbassador}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={AMBASSADOR_COMP_WIDTH}
        height={COMP_HEIGHT}
        defaultProps={{
          username: "stableronaldo",
          colorHex: "#000000",
        }}
        calculateMetadata={calculateMetadata as CalculateMetadataFunction<PillWithAmbassadorProps>}
      />
    </>
  );
};
