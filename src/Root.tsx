import React from "react";
import { CalculateMetadataFunction, Composition, staticFile, loadFont } from "remotion";
import { Pill, PillProps } from "./Pill";
import { PillWithAmbassador, PillWithAmbassadorProps } from "./PillWithAmbassador";

export const FPS = 30;
export const DURATION_IN_FRAMES = 180; // 6s: 50f in, 90f hold, 40f out
export const COMP_WIDTH = 2500;
export const COMP_HEIGHT = 1080;
// Wider canvas for the pill+ambassador pair. Height is unchanged from COMP_HEIGHT on
// purpose - only width grows to fit the extra badge, so a given export scale (e.g. 30%)
// produces the same pixel height with or without the ambassador badge attached.
export const AMBASSADOR_COMP_WIDTH = 4000;

// An export fps other than 30 changes the composition's real fps/duration (so the
// clip is still 6 real seconds) - everything else about the props is untouched.
// Pill.tsx/PillWithAmbassador.tsx convert their own playback frame back to the
// 30fps reference timeline, so no other metadata needs to change here.
const calculateMetadata: CalculateMetadataFunction<PillProps> = ({ props }) => {
  const fps = props.fps ?? FPS;
  return {
    fps,
    durationInFrames: Math.round((DURATION_IN_FRAMES * fps) / FPS),
  };
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
