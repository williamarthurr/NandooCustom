import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const toolsDirectory = fileURLToPath(new URL(".", import.meta.url));
const generatedAssetsDirectory = resolve(toolsDirectory, "..", "public", "custom-tools-assets");

export default defineConfig({
    root: resolve(toolsDirectory, "web"),
    publicDir: false,
    plugins: [{
        name: "clean-custom-tools-assets",
        buildStart() {
            if (existsSync(generatedAssetsDirectory)) {
                rmSync(generatedAssetsDirectory, { recursive: true, force: true });
            }
        },
    }],
    build: {
        outDir: resolve(toolsDirectory, "..", "public"),
        emptyOutDir: false,
        assetsDir: "custom-tools-assets",
        rollupOptions: {
            input: resolve(toolsDirectory, "web", "custom-tools.html"),
        },
    },
});
