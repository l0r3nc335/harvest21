import { NavbarWrapper } from "@/components/NavbarWrapper";
import { Footer } from "@/components/Footer";
import { fetchFooterContent } from "@/app/admin/homepage-settings/footerActions";
import { sanitizeHtmlForDisplay } from "@/lib/sanitizeHtml";

export default async function DonationPage() {
  const result = await fetchFooterContent("donate");
  const pageContent = result.success ? result.data : null;
  const sections = pageContent?.content.split("\n\n").filter((s) => s.trim()) || [];

  return (
    <div className="flex min-h-screen flex-col bg-[#000000]">
      <NavbarWrapper />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            {pageContent?.title || "Support Our Mission"}
          </h1>

          <div className="space-y-6 text-zinc-300 leading-relaxed">
            {sections.map((section, index) => (
              <div 
                key={index} 
                className="text-base sm:text-lg prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(section) }}
              />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
