import sanitizeHtml from "sanitize-html";
import type { IOptions } from "sanitize-html";

const TEXT_ALIGN = [/^left$/, /^right$/, /^center$/, /^justify$/];
const BACKGROUND_COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
];
const COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
];

// Only these tags may carry a scoped `style`. All other tags get no `style`.
const STYLE_CAPABLE_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "div",
  "blockquote",
  "li",
  "ol",
  "ul",
  "span",
  "mark",
]);

function buildAllowedAttributes(): IOptions["allowedAttributes"] {
  const attrs: Record<string, string[]> = {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "class", "width", "height"],
    video: ["src", "controls", "class", "poster", "preload"],
    source: ["src", "type"],
    mark: ["data-color", "class"],
    br: [],
    hr: [],
  };

  const classOnly = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
  ];
  for (const tag of classOnly) {
    attrs[tag] = ["class"];
  }

  for (const tag of STYLE_CAPABLE_TAGS) {
    attrs[tag] = ["class", "style"];
  }
  attrs.mark = ["data-color", "class", "style"];

  attrs.ol = ["start", "type", "class", "style"];
  attrs.div = ["class", "style", "data-type", "data-columns"];

  return attrs;
}

const USER_HTML_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "u",
    "ul",
    "video",
    "source",
  ],
  disallowedTagsMode: "discard",
  allowedAttributes: buildAllowedAttributes(),
  // Restrict style properties to a known-safe subset; drop everything else.
  allowedStyles: {
    "*": {
      "text-align": TEXT_ALIGN,
      "background-color": BACKGROUND_COLOR,
      color: COLOR,
    },
  },
  selfClosing: ["img", "br", "hr", "source"],
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    source: ["http", "https"],
    video: ["http", "https"],
    a: ["http", "https", "mailto"],
  },
  allowProtocolRelative: false,
  parseStyleAttributes: true,
  transformTags: {
    // Force safe link attributes on every <a>, drop javascript: via scheme allowlist.
    a: (tagName, attribs) => {
      const href = typeof attribs.href === "string" ? attribs.href : "";
      const target = attribs.target === "_blank" ? "_blank" : undefined;
      const next: Record<string, string> = {
        href,
        rel: "noopener noreferrer nofollow ugc",
      };
      if (target) next.target = target;
      if (attribs.title) next.title = attribs.title;
      if (attribs.class) next.class = attribs.class;
      return { tagName, attribs: next };
    },
  },
};

/**
 * Sanitize untrusted HTML before injecting with dangerouslySetInnerHTML.
 * Safe on the server (RSC) and the client; avoids JSDOM (Next/Turbopack compatible).
 */
export function sanitizeHtmlForDisplay(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, USER_HTML_SANITIZE_OPTIONS);
}
