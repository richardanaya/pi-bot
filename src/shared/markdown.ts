import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { isVideoUrl, isYoutubeUrl, youtubeEmbedUrl } from "./media.js";

const marked = new Marked({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rewriteMedia(raw), sanitizeOptions());
}

export function rewriteMedia(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    const src = attr(attrs, "src");
    const alt = attr(attrs, "alt") ?? "";
    if (!src) return full;
    if (isVideoUrl(src)) {
      return `<video controls src="${escapeAttr(src)}" title="${escapeAttr(alt)}"></video>`;
    }
    if (isYoutubeUrl(src)) {
      const embed = youtubeEmbedUrl(src);
      if (embed) {
        return `<iframe src="${escapeAttr(embed)}" title="${escapeAttr(alt)}" allowfullscreen></iframe>`;
      }
    }
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
  });
}

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return undefined;
  return match[2] ?? match[3] ?? match[4];
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sanitizeOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "video",
      "source",
      "iframe",
      "h1",
      "h2",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title"],
      video: ["src", "controls", "poster", "title"],
      source: ["src", "type"],
      iframe: ["src", "title", "allowfullscreen", "allow"],
      a: ["href", "title", "target", "rel"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
      video: ["http", "https", "data"],
      source: ["http", "https", "data"],
      iframe: ["http", "https"],
    },
    allowProtocolRelative: false,
  };
}
