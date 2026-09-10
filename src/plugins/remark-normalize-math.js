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
  const preprocessed = preprocessMathLines(preprocessBlockquoteMath(source));
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
 * Pull display math out of blockquote lines (`> $$`) so remark-math can see `$$`.
 * @param {string} source
 */
function preprocessBlockquoteMath(source) {
  const lines = source.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^>\s*\$\$/.test(line)) {
      const open = line.match(/^>\s*\$\$\s*(.*)$/);
      const trailing = open?.[1]?.trim() ?? "";

      if (trailing && trailing.endsWith("$$")) {
        out.push("$$", trailing.slice(0, -2).trim(), "$$", "");
        i += 1;
        continue;
      }

      out.push("$$");
      if (trailing) out.push(trailing);
      i += 1;

      while (i < lines.length) {
        const current = lines[i];

        if (/^>\s*\$\$\s*.*$/.test(current)) {
          const close = current.match(/^>\s*\$\$\s*(.*)$/);
          const rest = close?.[1]?.trim() ?? "";
          out.push(rest, "$$", "");
          i += 1;
          break;
        }

        if (/^>\s?/.test(current)) {
          out.push(current.replace(/^>\s?/, ""));
        } else {
          out.push(current);
        }
        i += 1;
      }
      continue;
    }

    out.push(line);
    i += 1;
  }

  return out.join("\n");
}

/**
 * Fix Obsidian-style patterns that break remark-math without touching LaTeX itself.
 * @param {string} source
 */
function preprocessMathLines(source) {
  return source
    .split("\n")
    .map((line) => {
      const singleLineListMath = line.match(/^(\d+\.\s*)\$\$(.+)\$\$\s*$/);
      if (singleLineListMath) {
        return `${singleLineListMath[1]}\n\n$$\n${singleLineListMath[2].trim()}\n$$`;
      }

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
