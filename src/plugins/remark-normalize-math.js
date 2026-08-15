/**
 * Normalize display-math delimiters so remark-math can parse them reliably.
 * Obsidian is lenient about `$$` placement; micromark requires block `$$` on their own lines.
 */

/** @typedef {import('unified').Plugin} Plugin */

/**
 * Wrap the Markdown parser so normalization runs before micromark tokenizes the source.
 * Must be registered in astro.config.mjs after remarkParse (via Astro) and before remarkMath.
 * @returns {Plugin}
 */
export function remarkNormalizeMath() {
  const self = this;
  const previousParser = self.parser;

  self.parser = (doc, file) => {
    const normalized = normalizeDisplayMath(String(doc));
    return previousParser.call(self, normalized, file);
  };
}

/**
 * @param {string} source
 * @returns {string}
 */
export function normalizeDisplayMath(source) {
  const preprocessed = preprocessMathLines(source);
  let out = "";
  let i = 0;

  while (i < preprocessed.length) {
    if (preprocessed.startsWith("$$", i) && !isEscaped(preprocessed, i)) {
      const block = readDisplayMathBlock(preprocessed, i);
      if (block) {
        out += block.normalized;
        i = block.end;
        continue;
      }
    }

    out += preprocessed[i];
    i += 1;
  }

  return out;
}

/**
 * Fix Obsidian-style patterns that break remark-math without touching LaTeX itself.
 * @param {string} source
 */
function preprocessMathLines(source) {
  return source
    .split("\n")
    .map((line) => {
      const listMath = line.match(/^(\d+\.\s*)\$\$(.*)$/);
      if (listMath) {
        const rest = listMath[2].trim();
        return rest ? `${listMath[1]}\n\n$$\n${rest}` : `${listMath[1]}\n\n$$`;
      }

      if (/^\s{2,}\$\$\s*$/.test(line)) {
        return "$$";
      }

      return line;
    })
    .join("\n");
}

/**
 * @param {string} source
 * @param {number} start
 */
function readDisplayMathBlock(source, start) {
  let i = start + 2;
  let content = "";

  while (i < source.length) {
    if (source.startsWith("$$", i) && !isEscaped(source, i)) {
      const normalized = `$$\n${content.trim()}\n$$\n`;
      return { normalized, end: i + 2 };
    }

    content += source[i];
    i += 1;
  }

  return null;
}

/**
 * @param {string} source
 * @param {number} index
 */
function isEscaped(source, index) {
  let slashes = 0;
  for (let j = index - 1; j >= 0 && source[j] === "\\"; j -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}
