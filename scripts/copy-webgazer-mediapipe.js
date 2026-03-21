const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wgRoot = path.join(root, "node_modules", "webgazer", "dist");

const mediapipeSrc = path.join(wgRoot, "mediapipe");
const mediapipeDest = path.join(root, "public", "mediapipe");
const bundleSrc = path.join(wgRoot, "webgazer.js");
const bundleDest = path.join(root, "public", "webgazer.js");

if (!fs.existsSync(wgRoot)) {
  console.warn("copy-webgazer-mediapipe: webgazer dist missing, skip");
  process.exit(0);
}

fs.mkdirSync(path.join(root, "public"), { recursive: true });

if (fs.existsSync(mediapipeSrc)) {
  fs.cpSync(mediapipeSrc, mediapipeDest, { recursive: true });
}

if (fs.existsSync(bundleSrc)) {
  fs.copyFileSync(bundleSrc, bundleDest);
}
