import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const packageJsonPath = path.join(root, "package.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const version = String(packageJson.version || "").trim();

if (!version) {
  throw new Error("package.json 未找到有效 version");
}

const cargoTomlRaw = fs.readFileSync(cargoTomlPath, "utf-8");
const cargoTomlNext = cargoTomlRaw.replace(
  /^version\s*=\s*".*?"$/m,
  `version = "${version}"`
);
if (cargoTomlRaw !== cargoTomlNext) {
  fs.writeFileSync(cargoTomlPath, cargoTomlNext, "utf-8");
}

const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"));
if (tauriConf.version !== version) {
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, "utf-8");
}

console.log(`Synced app version: ${version}`);
