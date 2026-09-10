import { glob } from "astro/loaders";
import fs from "node:fs/promises";
import { normalizeDisplayMath } from "./remark-normalize-math.js";

/**
 * Wrap Astro's glob loader so markdown is normalized before parse/render.
 * Ensures dev content-layer cache (`.astro/data-store.json`) picks up
 * normalize plugin changes via digest updates.
 *
 * @param {import('astro/loaders').GlobLoaderOptions} options
 */
export function normalizedGlob(options) {
  const inner = glob(options);

  return {
    name: "normalized-glob-loader",
    load: async (context) => {
      const contentRoot = new URL(options.base, context.config.root).pathname;
      const originalReadFile = fs.readFile;

      fs.readFile = async (path, encoding) => {
        const content = await originalReadFile(path, encoding);

        if (typeof content !== "string" || !/\.(md|mdx)$/.test(String(path))) {
          return content;
        }

        const normalizedPath = String(path).replace(/\\/g, "/");
        if (!normalizedPath.includes(contentRoot.replace(/\\/g, "/"))) {
          return content;
        }

        return normalizeDisplayMath(content);
      };

      try {
        await inner.load(context);
      } finally {
        fs.readFile = originalReadFile;
      }
    },
  };
}
