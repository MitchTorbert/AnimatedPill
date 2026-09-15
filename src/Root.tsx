import React from "react";
import { Composition, staticFile, loadFont } from "remotion";
import { Pill } from "./Pill";

export const FPS = 30;
export const DURATION_IN_FRAMES = 180; // 6s: 50f in, 90f hold, 40f out
export const COMP_WIDTH = 2500;
export const COMP_HEIGHT = 1080;

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
    </>
  );
};
