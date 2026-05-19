"use client";

import { useState } from "react";
import { HomepageBanner, HomepageSettings, FooterContent } from "@/types/homepage";
import { Settings, List, FileText } from "lucide-react";
import { BannerListTab } from "./homepage-settings/BannerListTab";
import { BannerFormTab } from "./homepage-settings/BannerFormTab";
import { GlobalSettingsTab } from "./homepage-settings/GlobalSettingsTab";
import { FooterSettingsSection } from "./homepage-settings/FooterSettingsSection";

type HomepageSettingsClientProps = {
  banners: HomepageBanner[];
  settings: HomepageSettings;
  footerContent: {
    about_us: FooterContent | null;
    statement_of_faith: FooterContent | null;
    donate: FooterContent | null;
    faq: FooterContent | null;
    contact_us: FooterContent | null;
    privacy_policy: FooterContent | null;
    terms_of_use: FooterContent | null;
  };
};

type TabType = "list" | "create" | "edit" | "settings" | "footer";

export function HomepageSettingsClient({
  banners: initialBanners,
  settings: initialSettings,
  footerContent,
}: HomepageSettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [banners, setBanners] = useState<HomepageBanner[]>(initialBanners);
  const [settings, setSettings] = useState<HomepageSettings>(initialSettings);

  const handleEdit = (banner: HomepageBanner) => {
    setEditingBanner(banner);
    setActiveTab("edit");
  };

  const handleCreate = () => {
    setEditingBanner(null);
    setActiveTab("create");
  };

  const handleSuccess = () => {
    setActiveTab("list");
    setEditingBanner(null);
    window.location.reload();
  };

  const handleCancel = () => {
    setActiveTab("list");
    setEditingBanner(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Homepage Settings</h1>
        <p className="text-zinc-600 mt-2">
          Manage homepage banner carousel, global settings, and footer page content
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("list")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            activeTab === "list" || activeTab === "create" || activeTab === "edit"
              ? "border-brand-yellow text-brand-yellow"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <List className="w-5 h-5" />
          Banners
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            activeTab === "settings"
              ? "border-brand-yellow text-brand-yellow"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <Settings className="w-5 h-5" />
          Banner Settings
        </button>
        <button
          onClick={() => setActiveTab("footer")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            activeTab === "footer"
              ? "border-brand-yellow text-brand-yellow"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <FileText className="w-5 h-5" />
          Footer Pages
        </button>
      </div>

      <div className="max-w-6xl">
        {(activeTab === "list" || activeTab === "create" || activeTab === "edit") && (
          <>
            {activeTab === "list" && (
              <BannerListTab
                banners={banners}
                onEdit={handleEdit}
                onCreate={handleCreate}
              />
            )}
            {(activeTab === "create" || activeTab === "edit") && (
              <BannerFormTab
                banner={editingBanner}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                maxOrder={banners.length}
              />
            )}
          </>
        )}

        {activeTab === "settings" && (
          <GlobalSettingsTab settings={settings} />
        )}

        {activeTab === "footer" && (
          <FooterSettingsSection
            aboutUsContent={footerContent.about_us}
            statementOfFaithContent={footerContent.statement_of_faith}
            donateContent={footerContent.donate}
            faqContent={footerContent.faq}
            contactUsContent={footerContent.contact_us}
            privacyPolicyContent={footerContent.privacy_policy}
            termsOfUseContent={footerContent.terms_of_use}
          />
        )}
      </div>
    </div>
  );
}

