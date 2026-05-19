"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, User, Heart, Globe2, Flag, Target, AlertTriangle, ArrowRight } from "lucide-react";
import type { TemplateConfig, TemplateFieldValue, TemplateSectionConfig } from "@/types/template";
import { StaticTitle } from "./sections/StaticTitle";

type TemplateRendererProps = {
  template: TemplateConfig;
  content: Record<string, TemplateFieldValue>;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  variant?: "default" | "missionaryAbout";
};

export function TemplateRenderer({
  template,
  content,
  videoUrl,
  thumbnailUrl,
  variant = "default",
}: TemplateRendererProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const renderSection = (section: TemplateSectionConfig) => {
    switch (section.type) {
      case "header":
        return renderHeaderSection(section);
      case "static-title":
        return renderStaticTitle(section);
      case "richtext":
        return renderRichText(section);
      case "two-column":
        return renderTwoColumn(section);
      default:
        return null;
    }
  };

  const renderHeaderSection = (section: TemplateSectionConfig) => {
    const titleField = section.fields.find((f) => f.id === "headerTitle");
    const subtitleField = section.fields.find((f) => f.id === "headerSubtitle");

    const title = (content[titleField?.id || ""] as string) || "";
    const subtitle = (content[subtitleField?.id || ""] as string) || "";
    console.log("VARIANT" + variant);
    // Simple header rendering when not using missionary about-page layout
    if (variant === "default" || template.id !== "about-you" || variant !== "missionaryAbout") {
      return (
        <div key={section.id} className="space-y-4">
          {videoUrl && (
            <div className="relative w-full max-w-4xl mx-auto aspect-video overflow-hidden rounded-2xl bg-[#0a0a0a] shadow-2xl ring-1 ring-white/10 mt-8">
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full object-contain"
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={handlePlayPause}
                />
                {!isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={handlePlayPause}
                  >
                    <div className="rounded-full bg-[#E1B94D]/90 p-5 transition-transform duration-300 hover:scale-110 hover:bg-[#E1B94D]">
                      <Play className="h-10 w-10 fill-black text-black" />
                    </div>
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handlePlayPause}
                        className="rounded-full bg-[#E1B94D] p-2 text-black hover:bg-[#d4a639]"
                      >
                        <Pause className="h-5 w-5" />
                      </button>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-white text-xs min-w-[40px]">
                          {formatTime(currentTime)}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          step="0.1"
                          value={currentTime}
                          onChange={handleSeek}
                          className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E1B94D]"
                          style={{
                            background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${
                              duration ? (currentTime / duration) * 100 : 0
                            }%, rgba(255,255,255,0.2) ${
                              duration ? (currentTime / duration) * 100 : 0
                            }%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                        <span className="text-white text-xs min-w-[40px]">
                          {formatTime(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleMuteToggle} className="text-white">
                          {isMuted ? (
                            <VolumeX className="h-5 w-5" />
                          ) : (
                            <Volume2 className="h-5 w-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E1B94D]"
                          style={{
                            background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${
                              (isMuted ? 0 : volume) * 100
                            }%, rgba(255,255,255,0.2) ${
                              (isMuted ? 0 : volume) * 100
                            }%, rgba(255,255,255,0.2) 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            </div>
          )}

          {(title || subtitle) && (
            <div className="text-left">
              {title && (
                <h2 className="mt-0! font-bold text-white">
                  {title}
                </h2>
              )}
              {subtitle && (
                <div className="text-white/90 prose prose-invert max-w-none whitespace-pre-line">
                  {subtitle}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Missionary-specific "Personal Bio" card styling
    const hasText = title || subtitle;

    if (!videoUrl && !hasText) {
      return null;
    }

    return (
      <div key={section.id} className="space-y-6">
        {videoUrl && (
          <div className="relative w-full max-w-4xl mx-auto aspect-video overflow-hidden rounded-3xl bg-[#050505] shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                poster={thumbnailUrl || undefined}
                className="w-full h-full object-contain"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onClick={handlePlayPause}
              />
              {!isPlaying && (
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer"
                  onClick={handlePlayPause}
                >
                  <div className="rounded-full bg-[#E1B94D]/95 p-5 transition-transform duration-300 hover:scale-110 hover:bg-[#E1B94D]">
                    <Play className="h-10 w-10 fill-black text-black" />
                  </div>
                </div>
              )}
              {isPlaying && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handlePlayPause}
                      className="rounded-full bg-[#E1B94D] p-2 text-black hover:bg-[#d4a639]"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-white text-xs min-w-[40px]">
                        {formatTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E1B94D]"
                        style={{
                          background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${
                            duration ? (currentTime / duration) * 100 : 0
                          }%, rgba(255,255,255,0.2) ${
                            duration ? (currentTime / duration) * 100 : 0
                          }%, rgba(255,255,255,0.2) 100%)`,
                        }}
                      />
                      <span className="text-white text-xs min-w-[40px]">
                        {formatTime(duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleMuteToggle} className="text-white">
                        {isMuted ? (
                          <VolumeX className="h-5 w-5" />
                        ) : (
                          <Volume2 className="h-5 w-5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E1B94D]"
                        style={{
                          background: `linear-gradient(to right, #E1B94D 0%, #E1B94D ${
                            (isMuted ? 0 : volume) * 100
                          }%, rgba(255,255,255,0.2) ${
                            (isMuted ? 0 : volume) * 100
                          }%, rgba(255,255,255,0.2) 100%)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          </div>
        )}

        {hasText && (
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
            <div className="flex items-start gap-4">
              <div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/40">
                    <User className="h-5 w-5 text-black" />
                  </div>
                  <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{title || "Personal Bio"}</span>
                  </div>
                </div>
                {subtitle && (
                  <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStaticTitle = (section: TemplateSectionConfig) => {
    const titleField = section.fields[0];
    const title = (content[titleField?.id || ""] as string) || titleField?.defaultValue || "";

    return <StaticTitle key={section.id} title={title as string} />;
  };

  const renderRichText = (section: TemplateSectionConfig) => {
    const field = section.fields[0];
    const text = (content[field?.id || ""] as string) || "";

    if (!text) return null;

    return (
      <div key={section.id}>
        <div className="prose prose-invert max-w-none whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  };

  const renderTwoColumn = (section: TemplateSectionConfig) => {
    if (!section.columns) return null;

    const leftTitle = section.columns.left.find((f) => f.type === "text");
    const leftList = section.columns.left.find((f) => f.type === "list");
    const rightTitle = section.columns.right.find((f) => f.type === "text");
    const rightList = section.columns.right.find((f) => f.type === "list");

    return (
      <div key={section.id}>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div>
            {leftTitle && (
              <h2 className=" font-semibold text-white">
                {(content[leftTitle.id] as string) || leftTitle.defaultValue}
              </h2>
            )}
            {leftList && (
              <ul>
                {((content[leftList.id] as string[]) || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#E1B94D]">•</span>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            {rightTitle && (
              <h2 className=" font-semibold text-white">
                {(content[rightTitle.id] as string) || rightTitle.defaultValue}
              </h2>
            )}
            {rightList && (
              <ul>
                {((content[rightList.id] as string[]) || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#E1B94D]">•</span>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMissionaryAboutLayout = () => {
    if (template.id !== "about-you") {
      return template.sections.map(renderSection);
    }

    const missionTitle =
      ((content["missionTitleText"] as string) || "The Mission").trim();
    const missionContent = (content["missionContent"] as string) || "";

    const goalsTitle =
      ((content["goalsTitle"] as string) || "Key Goals").trim();
    const goalsList = (content["goalsList"] as string[]) || [];

    const challengesTitle =
      ((content["challengesTitle"] as string) || "Challenges").trim();
    const challengesList = (content["challengesList"] as string[]) || [];

    const heartTitle =
      ((content["heartTitleText"] as string) || "The Heart Behind the Mission").trim();
    const heartContent = (content["heartContent"] as string) || "";

    const joinTitle =
      ((content["joinTitleText"] as string) || "Join in the Journey").trim();
    const joinContent = (content["joinContent"] as string) || "";

    const hasGoals = goalsList.length > 0;
    const hasChallenges = challengesList.length > 0;

    return (
      <>
        {/* Missionary about cards - mobile: Personal Bio, then The Mission, Key Goals, Heart, Challenges, Join */}
        <div className="mx-auto space-y-6 md:hidden">
          {(missionTitle || missionContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
                      <Target className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{missionTitle}</span>
                    </div>
                  </div>
                  {missionContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {missionContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasGoals && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/40">
                      <Flag className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{goalsTitle}</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-lg text-zinc-200">
                    {goalsList.map((item, index) => (
                      <li key={index} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {(heartTitle || heartContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/40">
                      <Heart className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{heartTitle}</span>
                    </div>
                  </div>
                  {heartContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {heartContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasChallenges && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/40">
                      <AlertTriangle className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{challengesTitle}</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-lg text-zinc-200">
                    {challengesList.map((item, index) => (
                      <li key={index} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {(joinTitle || joinContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/40">
                      <Globe2 className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{joinTitle}</span>
                    </div>
                  </div>
                  {joinContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {joinContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: masonry order (Mission, Heart, Join, Goals, Challenges) */}
        <div className="mx-auto hidden md:block columns-1 md:columns-2 space-y-6 md:space-y-0">
          {(missionTitle || missionContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
                      <Target className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{missionTitle}</span>
                    </div>
                  </div>
                  {missionContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {missionContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(heartTitle || heartContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/40">
                      <Heart className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{heartTitle}</span>
                    </div>
                  </div>
                  {heartContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {heartContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(joinTitle || joinContent) && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/40">
                      <Globe2 className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{joinTitle}</span>
                    </div>
                  </div>
                  {joinContent && (
                    <div className="mt-3 text-lg leading-relaxed text-zinc-200 whitespace-pre-line">
                      {joinContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasGoals && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/40">
                      <Flag className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{goalsTitle}</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-lg text-zinc-200">
                    {goalsList.map((item, index) => (
                      <li key={index} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {hasChallenges && (
            <div className="mb-6 break-inside-avoid rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 px-6 py-6 lg:px-8 lg:py-7 shadow-[0_25px_50px_-25px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-4">
                <div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/40">
                      <AlertTriangle className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex items-center justify-center text-lg font-semibold text-white leading-none -translate-y-[1px]">
                      <span className="text-xl font-semibold text-white">{challengesTitle}</span>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 text-lg text-zinc-200">
                    {challengesList.map((item, index) => (
                      <li key={index} className="grid grid-cols-[auto,1fr] gap-2 items-start">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const isMissionaryAboutLayout = variant === "missionaryAbout";

  return (
    <div className="template-renderer space-y-8">
      {template.sections.filter((section) => section.type === "header").map(renderSection)}

      {isMissionaryAboutLayout
        ? renderMissionaryAboutLayout()
        : template.sections
            .filter((section) => section.type !== "header")
            .map(renderSection)}
    </div>
  );
}