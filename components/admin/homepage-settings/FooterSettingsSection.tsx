"use client";

import { useState, useEffect } from "react";
import { FooterContent } from "@/types/homepage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateFooterContent } from "@/app/admin/homepage-settings/footerActions";
import { FAQEditor, FAQItem } from "./FAQEditor";
import { FooterRichTextEditor } from "./FooterRichTextEditor";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

type FooterSettingsSectionProps = {
  aboutUsContent: FooterContent | null;
  statementOfFaithContent: FooterContent | null;
  donateContent: FooterContent | null;
  faqContent: FooterContent | null;
  contactUsContent: FooterContent | null;
  privacyPolicyContent: FooterContent | null;
  termsOfUseContent: FooterContent | null;
};

type TabType = "about_us" | "statement_of_faith" | "donate" | "faq" | "contact_us" | "privacy_policy" | "terms_of_use";

export function FooterSettingsSection({
  aboutUsContent,
  statementOfFaithContent,
  donateContent,
  faqContent,
  contactUsContent,
  privacyPolicyContent,
  termsOfUseContent,
}: FooterSettingsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("about_us");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id);
    };
    fetchUser();
  }, []);

  // State for each page
  const [pageData, setPageData] = useState({
    about_us: { title: aboutUsContent?.title || "", content: aboutUsContent?.content || "" },
    statement_of_faith: { title: statementOfFaithContent?.title || "", content: statementOfFaithContent?.content || "" },
    donate: { title: donateContent?.title || "", content: donateContent?.content || "" },
    faq: { title: faqContent?.title || "", content: faqContent?.content || "" },
    contact_us: { title: contactUsContent?.title || "", content: contactUsContent?.content || "" },
    privacy_policy: { title: privacyPolicyContent?.title || "", content: privacyPolicyContent?.content || "" },
    terms_of_use: { title: termsOfUseContent?.title || "", content: termsOfUseContent?.content || "" },
  });

  // Parse FAQ items from JSON or initialize empty array
  const parseFAQItems = (content: string): FAQItem[] => {
    try {
      const parsed = JSON.parse(content);
      return parsed.items || [];
    } catch {
      return [];
    }
  };

  const [faqItems, setFaqItems] = useState<FAQItem[]>(
    parseFAQItems(faqContent?.content || "")
  );

  const handleSave = async (pageType: TabType) => {
    setLoading(true);
    
    let contentToSave = pageData[pageType].content;
    
    // For FAQ, convert items to JSON
    if (pageType === "faq") {
      contentToSave = JSON.stringify({ items: faqItems });
    }
    
    const result = await updateFooterContent(
      pageType, 
      pageData[pageType].title, 
      contentToSave,
      userId
    );

    if (result.success) {
      toast.success(`${getPageLabel(pageType)} content updated successfully`);
    } else {
      toast.error(result.error || `Failed to update ${getPageLabel(pageType)}`);
    }
    setLoading(false);
  };

  const getPageLabel = (pageType: TabType): string => {
    const labels: Record<TabType, string> = {
      about_us: "About Us",
      statement_of_faith: "Statement of Faith",
      donate: "Donate",
      faq: "FAQ",
      contact_us: "Contact Us",
      privacy_policy: "Privacy Policy",
      terms_of_use: "Terms of Use",
    };
    return labels[pageType];
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "about_us", label: "About Us" },
    { id: "statement_of_faith", label: "Statement of Faith" },
    { id: "donate", label: "Donate" },
    { id: "faq", label: "FAQ" },
    { id: "contact_us", label: "Contact Us" },
    { id: "privacy_policy", label: "Privacy Policy" },
    { id: "terms_of_use", label: "Terms of Use" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900">Footer Page Content</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Edit the content for each footer page. Enter plain text and use line breaks for formatting.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "text-brand-yellow border-b-2 border-brand-yellow"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Editor */}
      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Page Title
            </label>
            <Input
              value={pageData[activeTab].title}
              disabled
              className="bg-zinc-50 cursor-not-allowed"
            />
            <p className="text-xs text-zinc-500 mt-1">Title is read-only</p>
          </div>

          {activeTab === "faq" ? (
            <FAQEditor items={faqItems} onChange={setFaqItems} />
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Content (Rich Text)
              </label>
              <FooterRichTextEditor
                content={pageData[activeTab].content}
                onChange={(html) =>
                  setPageData({
                    ...pageData,
                    [activeTab]: { ...pageData[activeTab], content: html },
                  })
                }
                placeholder={`Enter content for ${getPageLabel(activeTab)} page...`}
              />
              <p className="text-xs text-zinc-500 mt-2">
                Use the toolbar to format your content with headings, bold, italic, lists, and links.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => handleSave(activeTab)} disabled={loading}>
              {loading ? "Saving..." : `Save ${getPageLabel(activeTab)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

