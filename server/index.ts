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

// The deployed instance has very little CPU/RAM (see earlier OOM fixes) - two
// people rendering at the same moment means two real headless-Chrome processes
// competing for that same tiny budget, which is exactly what caused those
// crashes before, just triggered by concurrency instead of a single heavy
// render. Queuing every render request through here means only one ever
// actually runs at a time; everyone else's request just waits its turn
// instead of racing and risking a crash for both.
let queueLength = 0;
let queueTail: Promise<void> = Promise.resolve();
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Render timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  queueLength++;
  const run = () => withTimeout(task(), RENDER_TIMEOUT_MS);
  const runTask = queueTail.then(run, run);
  queueTail = runTask.then(
    () => undefined,
    () => undefined
  );
  runTask.finally(() => {
    queueLength--;
  });
  return runTask;
}

app.get("/api/status", (_req, res) => {
  res.json({ busy: queueLength > 0, queueLength });
});

const ALLOWED_FPS = [23.976, 30, 60];
const GIF_FPS = 12.5;
type FileType = "mov" | "gif";

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
    // Rendered exactly as typed now - the leading "/" is normal, deletable text in
    // the client's input, not something this trims and Pill.tsx adds back.
    username: username.trim(),
    colorHex,
    ambassador: ambassador === true,
  };
}

function fileNameFor(pill: PillRequest, fileType: FileType): string {
  // A leading "/" reads fine in the pill graphic but not in a filename, so strip it
  // here specifically regardless of whether the pill itself shows one.
  const cleanName = pill.username.replace(/^\/+/, "");
  return `${cleanName} Pill.${fileType}`.replace(/[/\\?%*:|"<>]/g, "-");
}

async function renderOnePill(
  pill: PillRequest,
  scale: number,
  fps: number,
  fileType: FileType,
  outputPath: string
) {
  const location = await getBundle();
  const inputProps = { username: pill.username, colorHex: pill.colorHex, fps };
  const compositionId = pill.ambassador ? "PillWithAmbassador" : "Pill";
  const composition = await selectComposition({ serveUrl: location, id: compositionId, inputProps });

  // GIF can only do binary (on/off) transparency, not the soft anti-aliased alpha
  // ProRes 4444 gives us - the pill's rounded edges will look a little harder in a
  // GIF, which is an inherent limitation of the format, not something to fix here.
  const codecOptions =
    fileType === "gif"
      ? ({ codec: "gif", numberOfGifLoops: null, imageFormat: "png" } as const)
      : ({
          codec: "prores",
          proResProfile: "4444",
          pixelFormat: "yuva444p10le",
          imageFormat: "png",
        } as const);

  await renderMedia({
    composition,
    serveUrl: location,
    ...codecOptions,
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
  const fileType: FileType = body.fileType === "gif" ? "gif" : "mov";
  // Enforced server-side too, not just by the client hiding the fps dropdown - a
  // GIF is always 12.5fps regardless of what else is in the request.
  const fps = fileType === "gif" ? GIF_FPS : ALLOWED_FPS.includes(body.fps) ? body.fps : 30;

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
    path.join(os.tmpdir(), `pill-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileType}`);

  const performRender = async () => {
    if (pills.length === 1) {
      const outputPath = makeTmpPath();
      tmpOutputs.push(outputPath);
      await renderOnePill(pills[0], scale, fps, fileType, outputPath);
      // Awaited rather than fire-and-forget: performRender resolving is what
      // lets the queue move on to the next request (see enqueueRender) and is
      // what triggers the tmpOutputs cleanup below - both need to wait until
      // res.download() has actually finished reading the file, or the cleanup
      // can delete it out from under an in-progress download.
      await new Promise<void>((resolve, reject) => {
        res.download(outputPath, fileNameFor(pills[0], fileType), (err) => {
          if (err) {
            console.error("Download error", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      return;
    }

    // Multiple pills: render each in turn, package as one zip of separate files.
    const rendered: { path: string; name: string }[] = [];
    for (const pill of pills) {
      const outputPath = makeTmpPath();
      tmpOutputs.push(outputPath);
      await renderOnePill(pill, scale, fps, fileType, outputPath);
      rendered.push({ path: outputPath, name: fileNameFor(pill, fileType) });
    }

    const firstName = pills[0].username.replace(/^\/+/, "");
    const zipName = `${pills.length} Pills ${firstName}.zip`.replace(/[/\\?%*:|"<>]/g, "-");
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
  };

  try {
    await enqueueRender(performRender);
  } catch (err) {
    console.error("Render failed", err);
    if (!res.headersSent) {
      const message = err instanceof Error && err.message === "Render timed out" ? err.message : "Render failed. Check server logs.";
      res.status(500).json({ error: message });
    }
  } finally {
    for (const t of tmpOutputs) fs.unlink(t, () => {});
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;
app.listen(PORT, () => {
  console.log(`Pill generator running at http://localhost:${PORT}`);
});
