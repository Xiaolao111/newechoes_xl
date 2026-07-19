import katex from "katex";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function rehypeKatex() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (
        !parent ||
        ["code", "pre", "script", "style"].includes(parent.tagName) ||
        !node.value.includes("$")
      ) {
        return;
      }

      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = mathPattern.exec(node.value))) {
        if (match.index > lastIndex) {
          parts.push({ type: "text", value: node.value.slice(lastIndex, match.index) });
        }

        const displayMode = Boolean(match[1]);
        const expression = (match[1] ?? match[2]).trim();
        const rendered = katex.renderToString(expression, {
          displayMode,
          throwOnError: false,
        });
        parts.push(...fromHtml(rendered, { fragment: true }).children);
        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) {
        return;
      }

      if (lastIndex < node.value.length) {
        parts.push({ type: "text", value: node.value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
}
