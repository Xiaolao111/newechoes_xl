import { visit } from "unist-util-visit";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

/**
 * Renders Markdown image alt text as a semantic figure caption.
 */
export function remarkImageCaptions() {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      const image = node.children[0];
      if (!parent || image?.type !== "image" || !image.alt) {
        return;
      }

      const title = image.title ? ` title="${escapeHtml(image.title)}"` : "";
      const figure = {
        type: "html",
        value: `<figure class="article-figure"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}"${title}><figcaption>${escapeHtml(image.alt)}</figcaption></figure>`,
      };
      const trailingContent = node.children.slice(1);

      parent.children.splice(
        index,
        1,
        figure,
        ...(trailingContent.length > 0
          ? [{ type: "paragraph", children: trailingContent }]
          : []),
      );
    });
  };
}
