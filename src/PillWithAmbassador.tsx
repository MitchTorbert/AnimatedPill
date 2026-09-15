import React from "react";
import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Pill, PillProps, getPillMetrics, REST_PILL_HEIGHT } from "./Pill";

export interface PillWithAmbassadorProps extends PillProps {}

// The ambassador badge is a fixed, pre-made asset (real Twitch brand file - the
// purple-to-cyan gradient badge + checkmark + "Ambassador" text are already baked in,
// so nothing about its look is built here). It has no internal animation of its own -
// it's a single rigid image, always on a layer BELOW the username pill and never
// cropped/masked by anything - it's simply covered wherever the pill sits on top of it.
const AMBASSADOR_SRC = "images/ambassador-pill.png";
const AMBASSADOR_ASPECT = 1045 / 217;
const GAP = 48; // px between the username pill and the ambassador badge, at comp scale

// Sequenced relative to the username pill's own (untouched) 0-13 entrance and 146-159
// exit: the badge only starts sliding out once the pill has fully settled, and finishes
// tucking away well before the pill begins collapsing - never simultaneous with it.
const ENTER_START = 16;
const ENTER_DURATION = 10;
const ENTER_END = ENTER_START + ENTER_DURATION; // 26
const EXIT_DURATION = 10;
const EXIT_END = 130; // comfortably before the pill's own exit starts at 146
const EXIT_START = EXIT_END - EXIT_DURATION; // 120

const SCALE_START = 0.7; // starts at 70% size, fully tucked under the pill

// A single smooth, no-bounce ease (this is the FEEL "same slow easing curve" is asking
// for, not a literal reuse of the pill's own measured data/timing). Exit reads the same
// function with reversed time, so it is the exact mirror of the entrance, not just a
// similar-looking curve.
const ease = Easing.out(Easing.cubic);

function ambassadorProgressAt(frame: number): number {
  if (frame < ENTER_START) return 0;
  if (frame < ENTER_END) return ease((frame - ENTER_START) / ENTER_DURATION);
  if (frame < EXIT_START) return 1;
  if (frame < EXIT_END) return ease(1 - (frame - EXIT_START) / EXIT_DURATION);
  return 0;
}

export const PillWithAmbassador: React.FC<PillWithAmbassadorProps> = ({ username, colorHex }) => {
  const frame = useCurrentFrame();
  const { width: compWidth } = useVideoConfig();

  // Nothing about the username pill's own math changes - same metrics function the
  // standalone Pill uses, just also read here to lay the ambassador badge out beside it.
  const { restWidth: usernameRestWidth, curTop, curBottom } = getPillMetrics(username, frame);
  const centerY = (curTop + curBottom) / 2;

  const restAmbWidth = REST_PILL_HEIGHT * AMBASSADOR_ASPECT;
  const progress = ambassadorProgressAt(frame);

  // The pair (username pill + gap + ambassador, at their RESTING sizes) is centered as a
  // unit in the wide canvas - each element still grows from its own center, matching how
  // the standalone pill grows from the comp's center.
  const pairWidth = usernameRestWidth + GAP + restAmbWidth;
  const pairLeft = compWidth / 2 - pairWidth / 2;
  const usernameCenterX = pairLeft + usernameRestWidth / 2;
  const finalAmbCenterX = pairLeft + usernameRestWidth + GAP + restAmbWidth / 2;

  // Starts centered directly under the pill (at 70% scale, fully tucked - no masking
  // needed since a smaller badge centered on the pill's own center sits entirely within
  // its footprint) and slides out to its final resting spot as it grows to 100%.
  const scale = SCALE_START + (1 - SCALE_START) * progress;
  const ambWidth = restAmbWidth * scale;
  const ambHeight = REST_PILL_HEIGHT * scale;
  const ambCenterX = usernameCenterX + (finalAmbCenterX - usernameCenterX) * progress;

  // Only rendered during its own active window. Outside it, "tucked under the pill" would
  // otherwise mean sitting statically at 70% scale forever - fine while the pill is there
  // to cover it, but it'd be left exposed, floating alone, once the pill's own (separate,
  // untouched) exit collapses away later in the timeline.
  const ambassadorVisible = frame >= ENTER_START && frame <= EXIT_END;

  return (
    <AbsoluteFill>
      {/* Ambassador badge renders first (i.e. on a layer below, in stacking order) so the
          username pill visually covers it while tucked underneath - no clipping at all. */}
      {ambassadorVisible && (
        <Img
          src={staticFile(AMBASSADOR_SRC)}
          style={{
            position: "absolute",
            left: ambCenterX - ambWidth / 2,
            top: centerY - ambHeight / 2,
            width: ambWidth,
            height: ambHeight,
          }}
        />
      )}
      <Pill username={username} colorHex={colorHex} centerXOverride={usernameCenterX} />
    </AbsoluteFill>
  );
};
