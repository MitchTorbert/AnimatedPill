import React from "react";
import { Composition, staticFile, loadFont } from "remotion";
import { Pill } from "./Pill";
import { PillWithAmbassador } from "./PillWithAmbassador";

export const FPS = 30;
export const DURATION_IN_FRAMES = 180; // 6s: 50f in, 90f hold, 40f out
export const COMP_WIDTH = 2500;
export const COMP_HEIGHT = 1080;
// Wider canvas for the pill+ambassador pair. Height is unchanged from COMP_HEIGHT on
// purpose - only width grows to fit the extra badge, so a given export scale (e.g. 30%)
// produces the same pixel height with or without the ambassador badge attached.
export const AMBASSADOR_COMP_WIDTH = 4000;

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
      />
    </>
  );
};
