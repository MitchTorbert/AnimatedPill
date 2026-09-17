import React from "react";
import { CalculateMetadataFunction, Composition, staticFile, loadFont } from "remotion";
import { Pill, PillProps, measureText, PADDING_TOTAL, REST_PILL_HEIGHT } from "./Pill";
import { PillWithAmbassador, PillWithAmbassadorProps, AMBASSADOR_ASPECT, GAP } from "./PillWithAmbassador";

export const FPS = 30;
export const DURATION_IN_FRAMES = 180; // 6s: 50f in, 90f hold, 40f out
// Fallback size only - real exports size the canvas tightly around the actual
// pill (see calculateMetadata below), so these only show up in Studio before a
// username is typed.
export const COMP_WIDTH = 2500;
export const COMP_HEIGHT = 1080;
export const AMBASSADOR_COMP_WIDTH = 4000;
// Small safety margin around the pill's own rest-size bounding box, mainly so
// the anti-aliased edge of its rounded corners never has a chance to clip.
const CROP_MARGIN = 12;

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
  const height = Math.ceil(REST_PILL_HEIGHT) + CROP_MARGIN * 2;

  if (compositionId === "PillWithAmbassador") {
    const restAmbWidth = REST_PILL_HEIGHT * AMBASSADOR_ASPECT;
    const pairWidth = restWidth + GAP + restAmbWidth;
    return { fps, durationInFrames, width: Math.ceil(pairWidth) + CROP_MARGIN * 2, height };
  }

  return { fps, durationInFrames, width: Math.ceil(restWidth) + CROP_MARGIN * 2, height };
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
