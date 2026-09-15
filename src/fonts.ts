import { continueRender, delayRender, staticFile } from "remotion";

const handle = delayRender("Loading RoobertTWITCH font");

const font = new FontFace(
  "RoobertTWITCH",
  `url(${staticFile("fonts/RoobertTWITCH-Medium.otf")})`,
  { weight: "500" }
);

font
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    console.error("Font failed to load", err);
    continueRender(handle);
  });
