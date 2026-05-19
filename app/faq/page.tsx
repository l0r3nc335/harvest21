import { NavbarWrapper } from "@/components/NavbarWrapper";
import { Footer } from "@/components/Footer";
import { fetchFooterContent } from "@/app/admin/homepage-settings/footerActions";
import { FooterContentRenderer } from "@/components/FooterContentRenderer";

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export default async function FAQPage() {
  const result = await fetchFooterContent("faq");
  const pageContent = result.success ? result.data : null;
  
  // Parse FAQ items from JSON
  let faqItems: FAQItem[] = [];
  try {
    const parsed = JSON.parse(pageContent?.content || "{}");
    faqItems = parsed.items || [];
  } catch (error) {
    console.error("Error parsing FAQ content:", error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#000000]">
      <NavbarWrapper />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-12">
            {pageContent?.title || "Frequently Asked Questions"}
          </h1>
          
          <div className="space-y-8">
            {faqItems.map((item, index) => (
              <div key={item.id} className="border-b border-zinc-800 pb-8 last:border-0">
                <h2 className="text-xl sm:text-2xl font-semibold text-brand-yellow mb-4">
                  {index + 1}. {item.question}
                </h2>
                <div className="text-base sm:text-lg text-zinc-300 leading-relaxed">
                  {item.answer ? (
                    <FooterContentRenderer htmlContent={item.answer} />
                  ) : (
                    <p className="text-zinc-400 italic">No answer provided.</p>
                  )}
                </div>
              </div>
            ))}
            
            {faqItems.length === 0 && (
              <p className="text-zinc-400 text-center py-12">
                No FAQ items available at this time.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
