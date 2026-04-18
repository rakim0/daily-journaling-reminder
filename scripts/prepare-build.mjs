import { copyFile, mkdir } from "node:fs/promises";

const filesToCopy = ["manifest.json", "styles.css", "versions.json"];

await mkdir("build", { recursive: true });

for (const file of filesToCopy) {
  await copyFile(file, `build/${file}`);
}
