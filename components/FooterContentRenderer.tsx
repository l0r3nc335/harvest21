import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";

type FooterContentRendererProps = {
  htmlContent: string;
};

export function FooterContentRenderer({ htmlContent }: FooterContentRendererProps) {
  const safeHtml = sanitizeHtmlForDisplay(htmlContent);

  return (
    <div 
      className="prose prose-invert max-w-none
        prose-headings:text-brand-yellow 
        prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4
        prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4
        prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
        prose-p:text-zinc-300 prose-p:text-base prose-p:sm:text-lg prose-p:leading-relaxed prose-p:mb-4
        prose-a:text-blue-400 prose-a:underline hover:prose-a:text-blue-300
        prose-strong:text-white prose-strong:font-semibold
        prose-em:text-zinc-200 prose-em:italic
        prose-ul:text-zinc-300 prose-ul:list-disc prose-ul:ml-6 prose-ul:mb-4 prose-ul:pl-6
        prose-ol:text-zinc-300 prose-ol:list-decimal prose-ol:ml-6 prose-ol:mb-4 prose-ol:pl-6
        prose-li:mb-2 prose-li:list-item"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

