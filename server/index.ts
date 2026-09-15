import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import archiver from "archiver";
import { fileURLToPath } from "url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { BRAND_COLOR_GROUPS } from "../src/colors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(projectRoot, "public")));

// In Docker, scripts/build-bundle.mjs writes here at image build time, so the
// small always-on instance never has to do this memory-heavy step itself - it
// only has to run the (much lighter) render step. Local dev has no prebuilt
// bundle, so it falls back to bundling on first request, same as always.
const PREBUILT_BUNDLE = path.join(projectRoot, "remotion-bundle");

let bundleLocation: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleLocation) return bundleLocation;
  if (fs.existsSync(PREBUILT_BUNDLE)) {
    bundleLocation = PREBUILT_BUNDLE;
    return bundleLocation;
  }
  console.log("Bundling Remotion project (first request only, ~10-20s)...");
  bundleLocation = await bundle({
    entryPoint: path.join(projectRoot, "src", "index.ts"),
  });
  console.log("Bundle ready.");
  return bundleLocation;
}

// Warm the bundle at server startup so the first user render isn't slow.
getBundle().catch((err) => console.error("Bundle warmup failed", err));

app.get("/api/colors", (_req, res) => {
  res.json(BRAND_COLOR_GROUPS);
});

// Authoritative hex -> colloquial name lookup, straight from the same palette the
// color picker renders from - the filename never depends on the client correctly
// tracking or sending a name alongside the hex.
const HEX_TO_COLOR_NAME = new Map<string, string>(
  BRAND_COLOR_GROUPS.flatMap((group) => group.colors.map((c) => [c.hex.toUpperCase(), c.name] as const))
);

interface PillRequest {
  username: string;
  colorHex: string;
  ambassador?: boolean;
}

function validatePill(p: unknown): PillRequest | null {
  if (typeof p !== "object" || p === null) return null;
  const { username, colorHex, ambassador } = p as Record<string, unknown>;
  if (typeof username !== "string" || !username.trim()) return null;
  if (typeof colorHex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(colorHex)) return null;
  return {
    username: username.trim().replace(/^\/+/, ""),
    colorHex,
    ambassador: ambassador === true,
  };
}

function fileNameFor(pill: PillRequest): string {
  const colorName = HEX_TO_COLOR_NAME.get(pill.colorHex.toUpperCase()) ?? "Custom";
  return `${pill.username} Pill ${colorName}.mov`.replace(/[/\\?%*:|"<>]/g, "-");
}

async function renderOnePill(pill: PillRequest, scale: number, outputPath: string) {
  const location = await getBundle();
  const inputProps = { username: pill.username, colorHex: pill.colorHex };
  const compositionId = pill.ambassador ? "PillWithAmbassador" : "Pill";
  const composition = await selectComposition({ serveUrl: location, id: compositionId, inputProps });

  await renderMedia({
    composition,
    serveUrl: location,
    codec: "prores",
    proResProfile: "4444",
    pixelFormat: "yuva444p10le",
    imageFormat: "png",
    muted: true,
    scale,
    outputLocation: outputPath,
    inputProps,
    // Chrome defaults to single-process mode on Linux, which badly limits render
    // speed on a real multi-core host - this only matters on the Docker/Linux
    // deploy target, not local macOS dev.
    chromiumOptions: { enableMultiProcessOnLinux: true },
    // Defaults to running several render processes in parallel (half the CPU
    // threads) to go faster, which multiplies memory use per render. On a
    // fractional-CPU host there's little real parallelism to gain from that
    // anyway, so keep it to one process and trade the (small) speed upside for
    // a lot more memory headroom.
    concurrency: 1,
  });
}

app.post("/api/render", async (req, res) => {
  const body = req.body ?? {};
  const rawPills = Array.isArray(body.pills) ? body.pills : [body]; // back-compat: single {username,colorHex} body
  const scale = typeof body.scale === "number" && body.scale > 0 && body.scale <= 1 ? body.scale : 1;

  const pills: PillRequest[] = [];
  for (const raw of rawPills) {
    const p = validatePill(raw);
    if (!p) {
      res.status(400).json({ error: "Each pill needs a username and a colorHex like #9146FF" });
      return;
    }
    pills.push(p);
  }
  if (pills.length === 0) {
    res.status(400).json({ error: "No pills to render" });
    return;
  }

  const tmpOutputs: string[] = [];
  const makeTmpPath = () =>
    path.join(os.tmpdir(), `pill-${Date.now()}-${Math.random().toString(36).slice(2)}.mov`);

  try {
    if (pills.length === 1) {
      const outputPath = makeTmpPath();
      tmpOutputs.push(outputPath);
      await renderOnePill(pills[0], scale, outputPath);
      res.download(outputPath, fileNameFor(pills[0]), (err) => {
        fs.unlink(outputPath, () => {});
        if (err) console.error("Download error", err);
      });
      return;
    }

    // Multiple pills: render each in turn, package as one zip of separate files.
    const rendered: { path: string; name: string }[] = [];
    for (const pill of pills) {
      const outputPath = makeTmpPath();
      tmpOutputs.push(outputPath);
      await renderOnePill(pill, scale, outputPath);
      rendered.push({ path: outputPath, name: fileNameFor(pill) });
    }

    const zipName = `Pills ${pills
      .slice(0, 2)
      .map((p) => p.username)
      .join(" ")}.zip`.replace(/[/\\?%*:|"<>]/g, "-");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Zip error", err);
      res.status(500).end();
    });
    archive.pipe(res);
    for (const r of rendered) {
      archive.file(r.path, { name: r.name });
    }
    await archive.finalize();
    for (const t of tmpOutputs) fs.unlink(t, () => {});
  } catch (err) {
    console.error("Render failed", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Render failed. Check server logs." });
    }
    for (const t of tmpOutputs) fs.unlink(t, () => {});
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
app.listen(PORT, () => {
  console.log(`Pill generator running at http://localhost:${PORT}`);
});
