import path from "path";
import { fileURLToPath } from "url";
import { bundle } from "@remotion/bundler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

await bundle({
  entryPoint: path.join(projectRoot, "src", "index.ts"),
  outDir: path.join(projectRoot, "remotion-bundle"),
});

console.log("Bundle written to remotion-bundle/");
