import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Pill, PillProps, getPillMetrics, REST_PILL_HEIGHT } from "./Pill";
import motion from "./pill-motion.json";

export interface PillWithAmbassadorProps extends PillProps {}

// The ambassador badge is a fixed, pre-made asset (real Twitch brand file - the
// purple-to-cyan gradient badge + checkmark + "Ambassador" text are already baked in,
// so nothing about its look is built here). It has no internal animation of its own -
// it's a single rigid image that scales/positions as one block.
const AMBASSADOR_SRC = "images/ambassador-pill.png";
const AMBASSADOR_ASPECT = 1045 / 217;
const GAP = 48; // px between the username pill and the ambassador badge, at comp scale

const { pillWidthScale } = motion as { pillWidthScale: number[] };

// Same "slow ease" character as the username pill's own entrance, borrowed directly from
// its real measured scale curve (normalized to 0-1) rather than a generic/guessed spring -
// this is what "use the same easing curves from the original pill" means here. The exit is
// built as the literal time-reversal of this same table, over the pill's own 146-159
// collapse window (13 frames - the same duration as the entrance table), so it's an exact
// mirror rather than an independently-tuned curve.
const ENTER_END = 13;
const EXIT_START = 146;
const EXIT_END = 159;

const enterProgressTable: number[] = (() => {
  const start = pillWidthScale[0];
  const end = pillWidthScale[ENTER_END];
  const range = end - start || 1;
  const table: number[] = [];
  for (let i = 0; i <= ENTER_END; i++) {
    table.push(Math.max(0, Math.min(1, (pillWidthScale[i] - start) / range)));
  }
  return table;
})();

function ambassadorProgressAt(frame: number): number {
  if (frame <= 0) return enterProgressTable[0];
  if (frame < ENTER_END) return enterProgressTable[Math.round(frame)];
  if (frame < EXIT_START) return 1;
  if (frame < EXIT_END) {
    const framesIntoExit = frame - EXIT_START;
    const mirroredIndex = ENTER_END - framesIntoExit;
    return enterProgressTable[Math.max(0, Math.min(ENTER_END, Math.round(mirroredIndex)))];
  }
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
  const ambWidth = restAmbWidth * progress;
  const ambHeight = REST_PILL_HEIGHT * progress;

  // The pair (username pill + gap + ambassador, at their RESTING sizes) is centered as a
  // unit in the wide canvas - each element still grows from its own center, matching how
  // the standalone pill grows from the comp's center.
  const pairWidth = usernameRestWidth + GAP + restAmbWidth;
  const pairLeft = compWidth / 2 - pairWidth / 2;
  const usernameCenterX = pairLeft + usernameRestWidth / 2;
  const ambassadorCenterX = pairLeft + usernameRestWidth + GAP + restAmbWidth / 2;

  return (
    <AbsoluteFill>
      <Pill username={username} colorHex={colorHex} centerXOverride={usernameCenterX} />
      <Img
        src={staticFile(AMBASSADOR_SRC)}
        style={{
          position: "absolute",
          left: ambassadorCenterX - ambWidth / 2,
          top: centerY - ambHeight / 2,
          width: ambWidth,
          height: ambHeight,
        }}
      />
    </AbsoluteFill>
  );
};
