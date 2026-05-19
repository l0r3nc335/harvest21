import { NavbarWrapper } from "@/components/NavbarWrapper";
import { Footer } from "@/components/Footer";
import { FooterContentRenderer } from "@/components/FooterContentRenderer";
import { fetchFooterContent } from "@/app/admin/homepage-settings/footerActions";

export default async function TermsOfUsePage() {
  const result = await fetchFooterContent("terms_of_use");
  const pageContent = result.success ? result.data : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#000000]">
      <NavbarWrapper />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-8">
            {pageContent?.title || "Terms of Use"}
          </h1>
          
          <FooterContentRenderer htmlContent={pageContent?.content || ""} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
