"use client";

import { useState } from "react";
import { HomepageSettings } from "@/types/homepage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateHomepageSettings } from "@/app/admin/homepage-settings/actions";
import toast from "react-hot-toast";

type GlobalSettingsTabProps = {
  settings: HomepageSettings;
};

export function GlobalSettingsTab({ settings: initialSettings }: GlobalSettingsTabProps) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(initialSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateHomepageSettings({
      banner_type: settings.banner_type,
      auto_scroll: settings.auto_scroll,
      scroll_timing: settings.scroll_timing,
      show_navigation_arrows: settings.show_navigation_arrows,
      show_pagination_dots: settings.show_pagination_dots,
    });

    if (result.success) {
      toast.success("Settings updated successfully");
      window.location.reload();
    } else {
      toast.error(result.error || "Failed to update settings");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900">Global Settings</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Configure global homepage banner settings
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Banner Type
            </label>
            <select
              value={settings.banner_type}
              onChange={(e) =>
                setSettings({ ...settings, banner_type: e.target.value as "carousel" | "static" | "video" })
              }
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
            >
              <option value="carousel">Carousel</option>
              <option value="static">Static</option>
              <option value="video">Video</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              Currently only carousel is fully supported
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.auto_scroll}
                onChange={(e) =>
                  setSettings({ ...settings, auto_scroll: e.target.checked })
                }
                className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
              />
              <div>
                <span className="text-sm font-medium text-zinc-700">Auto Scroll</span>
                <p className="text-xs text-zinc-500">
                  Automatically transition between slides
                </p>
              </div>
            </label>

            {settings.auto_scroll && (
              <div className="ml-7">
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Scroll Timing (ms)
                </label>
                <Input
                  type="number"
                  min="1000"
                  step="100"
                  value={settings.scroll_timing}
                  onChange={(e) =>
                    setSettings({ ...settings, scroll_timing: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Default time between slides (5000ms = 5 seconds)
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.show_navigation_arrows}
                onChange={(e) =>
                  setSettings({ ...settings, show_navigation_arrows: e.target.checked })
                }
                className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
              />
              <div>
                <span className="text-sm font-medium text-zinc-700">
                  Show Navigation Arrows
                </span>
                <p className="text-xs text-zinc-500">Display prev/next buttons</p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.show_pagination_dots}
                onChange={(e) =>
                  setSettings({ ...settings, show_pagination_dots: e.target.checked })
                }
                className="w-4 h-4 text-brand-yellow rounded focus:ring-brand-yellow"
              />
              <div>
                <span className="text-sm font-medium text-zinc-700">
                  Show Pagination Dots
                </span>
                <p className="text-xs text-zinc-500">Display slide indicators</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

