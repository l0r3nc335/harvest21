import type { OutputData } from "@/components/editor/types";

export function editorDataToHTML(data: OutputData): string {
  if (!data.blocks || data.blocks.length === 0) {
    return "";
  }

  return data.blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          const level = (block.data as any).level || 2;
          const text = (block.data as any).text || "";
          return `<h${level}>${text}</h${level}>`;
        case "paragraph":
          return `<p>${(block.data as any).text || ""}</p>`;
        case "list":
          const items = (block.data as any).items || [];
          const style = (block.data as any).style || "unordered";
          if (style === "ordered") {
            return `<ol>${items.map((item: string) => `<li>${item}</li>`).join("")}</ol>`;
          }
          return `<ul>${items.map((item: string) => `<li>${item}</li>`).join("")}</ul>`;
        case "image":
          const imageUrl = (block.data as any).url || "";
          const imageCaption = (block.data as any).caption || "";
          return `<figure><img src="${imageUrl}" alt="${imageCaption}" /><figcaption>${imageCaption}</figcaption></figure>`;
        case "video":
          const videoUrl = (block.data as any).url || "";
          const videoCaption = (block.data as any).caption || "";
          return `<figure><video src="${videoUrl}" controls></video><figcaption>${videoCaption}</figcaption></figure>`;
        case "columns":
          const content = (block.data as any).content || [];
          const columns =
            (block.data as any).columns || (Array.isArray(content) ? content.length : 2) || 2;
          return `<div data-type="columns" data-columns="${columns}">${content
            .map(
              (col: string) =>
                `<div data-type="column" class="tiptap-column">${col}</div>`,
            )
            .join("")}</div>`;
        case "delimiter":
          return "<hr />";
        default:
          return "";
      }
    })
    .join("");
}

export function htmlToEditorData(html: string): OutputData {
  if (typeof window === "undefined" || !html || html.trim() === "") {
    return { blocks: [], version: "2.28.0" };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const blocks: any[] = [];

    Array.from(doc.body.children).forEach((element) => {
      if (element.tagName.match(/^H[1-5]$/)) {
        const level = parseInt(element.tagName.substring(1));
        blocks.push({
          type: "header",
          data: {
            level,
            text: element.innerHTML || element.textContent || "",
          },
        });
      } else if (element.tagName === "P") {
        blocks.push({
          type: "paragraph",
          data: {
            text: element.innerHTML || element.textContent || "",
          },
        });
      } else if (element.tagName === "UL" || element.tagName === "OL") {
        const items = Array.from(element.querySelectorAll("li")).map((li) => li.innerHTML || li.textContent || "");
        blocks.push({
          type: "list",
          data: {
            style: element.tagName === "OL" ? "ordered" : "unordered",
            items,
          },
        });
      } else if (element.tagName === "HR") {
        blocks.push({
          type: "delimiter",
          data: {},
        });
      } else if (element.tagName === "IMG") {
        blocks.push({
          type: "image",
          data: {
            url: (element as HTMLImageElement).src,
            caption: (element as HTMLImageElement).alt || "",
          },
        });
      } else if (element.tagName === "VIDEO") {
        blocks.push({
          type: "video",
          data: {
            url: (element as HTMLVideoElement).src,
            caption: "",
          },
        });
      } else if (element.tagName === "FIGURE") {
        const img = element.querySelector("img");
        const video = element.querySelector("video");
        const figcaption = element.querySelector("figcaption");
        const caption = figcaption?.textContent || "";

        if (img) {
          blocks.push({
            type: "image",
            data: {
              url: img.src,
              caption,
            },
          });
        } else if (video) {
          blocks.push({
            type: "video",
            data: {
              url: video.src,
              caption,
            },
          });
        }
      } else if (element.getAttribute("data-type") === "columns") {
        const columnNodes = element.querySelectorAll('[data-type="column"]');
        const content = Array.from(columnNodes).map((col) => col.innerHTML);

        const columns = columnNodes.length || 2;

        blocks.push({
          type: "columns",
          data: {
            columns,
            content,
          },
        });
      }
    });

    return { blocks, version: "2.28.0" };
  } catch (error) {
    console.error("Error parsing HTML to editor data:", error);
    return { blocks: [], version: "2.28.0" };
  }
}

