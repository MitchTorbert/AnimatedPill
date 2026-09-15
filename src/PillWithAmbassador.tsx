import React from "react";
import { AbsoluteFill, Easing, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Pill, PillProps, getPillMetrics, REST_PILL_HEIGHT } from "./Pill";

export interface PillWithAmbassadorProps extends PillProps {}

// The ambassador badge is a fixed, pre-made asset (real Twitch brand file - the
// purple-to-cyan gradient badge + checkmark + "Ambassador" text are already baked in,
// so nothing about its look is built here). It has no internal animation of its own -
// it's a single rigid image that slides/scales as one block.
const AMBASSADOR_SRC = "images/ambassador-pill.png";
const AMBASSADOR_ASPECT = 1045 / 217;
const GAP = 48; // px between the username pill and the ambassador badge, at comp scale

// Sequenced relative to the username pill's own (untouched) 0-13 entrance and 146-159
// exit: the badge only starts sliding out once the pill has fully settled, and finishes
// tucking away well before the pill begins collapsing - never simultaneous with it.
const ENTER_START = 24;
const ENTER_DURATION = 24;
const ENTER_END = ENTER_START + ENTER_DURATION; // 48
const EXIT_DURATION = 24;
const EXIT_END = 134; // comfortably before the pill's own exit starts at 146
const EXIT_START = EXIT_END - EXIT_DURATION; // 110

const SCALE_START = 0.85; // "starting smaller than the normal pill"
// How far back (as a fraction of the badge's own rest width) it starts tucked behind the
// pill. Needs to be large enough that even its right edge sits behind the pill's right
// edge at rest - the badge is wider than most usernames, so the clip mask (see render)
// is what actually guarantees full concealment, but this keeps the un-clipped geometry
// consistent with it rather than fighting it.
const SLIDE_FRACTION = 1.0;

// A single smooth, no-bounce ease (this is what "same slow easing curve" means here -
// the FEEL, not a literal reuse of the pill's own measured data). Exit reads the same
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
  const { width: compWidth, height: compHeight } = useVideoConfig();

  // Nothing about the username pill's own math changes - same metrics function the
  // standalone Pill uses, just also read here to lay the ambassador badge out beside it.
  const { restWidth: usernameRestWidth, curTop, curBottom } = getPillMetrics(username, frame);
  const centerY = (curTop + curBottom) / 2;

  const restAmbWidth = REST_PILL_HEIGHT * AMBASSADOR_ASPECT;
  const progress = ambassadorProgressAt(frame);

  const scale = SCALE_START + (1 - SCALE_START) * progress;
  const ambWidth = restAmbWidth * scale;
  const ambHeight = REST_PILL_HEIGHT * scale;

  // The pair (username pill + gap + ambassador, at their RESTING sizes) is centered as a
  // unit in the wide canvas - each element still grows from its own center, matching how
  // the standalone pill grows from the comp's center.
  const pairWidth = usernameRestWidth + GAP + restAmbWidth;
  const pairLeft = compWidth / 2 - pairWidth / 2;
  const usernameCenterX = pairLeft + usernameRestWidth / 2;
  const usernameRightEdge = pairLeft + usernameRestWidth;
  const finalAmbCenterX = pairLeft + usernameRestWidth + GAP + restAmbWidth / 2;

  // Slides out from behind the pill's right edge (mostly hidden underneath it at
  // progress 0) to its final resting spot beside the pill (progress 1).
  const slideDistance = restAmbWidth * SLIDE_FRACTION;
  const ambCenterX = finalAmbCenterX - slideDistance * (1 - progress);

  return (
    <AbsoluteFill>
      {/* Ambassador badge renders first (i.e. beneath, in stacking order) so the
          username pill visually covers it while it's still tucked underneath.
          It's also clipped to never draw left of the pill's own right edge - the
          badge is much wider than most usernames, so sliding alone can't guarantee
          it stays fully hidden at rest without this, regardless of retraction
          distance (a wide-enough badge pokes out one side or the other). */}
      <div
        style={{
          position: "absolute",
          left: usernameRightEdge,
          top: 0,
          width: compWidth - usernameRightEdge,
          height: compHeight,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(AMBASSADOR_SRC)}
          style={{
            position: "absolute",
            left: ambCenterX - ambWidth / 2 - usernameRightEdge,
            top: centerY - ambHeight / 2,
            width: ambWidth,
            height: ambHeight,
          }}
        />
      </div>
      <Pill username={username} colorHex={colorHex} centerXOverride={usernameCenterX} />
    </AbsoluteFill>
  );
};
