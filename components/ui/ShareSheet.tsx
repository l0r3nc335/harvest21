"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, Link2, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

type ShareSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
};

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.627-5.373-12-12-12zm6.066 13.666c.005.145.005.29 0 .435-.2 3.747-4.066 6.399-8.066 6.399s-7.866-2.652-8.066-6.399a3.724 3.724 0 010-.435 1.849 1.849 0 01-.733-1.471c0-1.024.832-1.856 1.856-1.856.507 0 .967.206 1.3.539 1.286-.876 2.99-1.395 4.82-1.442l.924-4.34a.338.338 0 01.404-.262l3.074.653a1.31 1.31 0 012.39.674 1.312 1.312 0 01-1.312 1.312 1.312 1.312 0 01-1.3-1.156l-2.7-.574-.818 3.835c1.788.063 3.448.586 4.705 1.448a1.843 1.843 0 011.3-.539c1.024 0 1.856.832 1.856 1.856 0 .593-.28 1.12-.716 1.459l.082.021zm-11.17.652c0 .724.588 1.312 1.312 1.312.724 0 1.312-.588 1.312-1.312 0-.724-.588-1.312-1.312-1.312-.724 0-1.312.588-1.312 1.312zm7.304 2.858c-.156.156-.366.242-.586.242a.83.83 0 01-.586-.242 3.973 3.973 0 00-2.028-.768 3.973 3.973 0 00-2.028.768.83.83 0 01-1.172 0 .83.83 0 010-1.172 5.634 5.634 0 013.2-1.086 5.634 5.634 0 013.2 1.086.83.83 0 010 1.172zm-.272-1.546c0-.724-.588-1.312-1.312-1.312-.724 0-1.312.588-1.312 1.312 0 .724.588 1.312 1.312 1.312.724 0 1.312-.588 1.312-1.312z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function ShareSheet({ isOpen, onClose, url, title }: ShareSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(checkScroll);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, checkScroll]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  if (!isOpen || typeof window === "undefined") return null;

  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const platforms = [
    {
      name: "Facebook",
      icon: <FacebookIcon />,
      bg: "bg-[#1877F2]",
      onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`, "_blank", "noopener,noreferrer"),
    },
    {
      name: "Instagram",
      icon: <InstagramIcon />,
      bg: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
      onClick: handleCopy,
      tooltip: "Link copied! Paste it in your Instagram story or bio.",
    },
    {
      name: "WhatsApp",
      icon: <WhatsAppIcon />,
      bg: "bg-[#25D366]",
      onClick: () => window.open(`https://wa.me/?text=${encTitle}%20${encUrl}`, "_blank", "noopener,noreferrer"),
    },
    {
      name: "X",
      icon: <XIcon />,
      bg: "bg-black",
      onClick: () => window.open(`https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`, "_blank", "noopener,noreferrer"),
    },
    {
      name: "LinkedIn",
      icon: <LinkedInIcon />,
      bg: "bg-[#0A66C2]",
      onClick: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`, "_blank", "noopener,noreferrer"),
    },
    {
      name: "Reddit",
      icon: <RedditIcon />,
      bg: "bg-[#FF4500]",
      onClick: () => window.open(`https://www.reddit.com/submit?url=${encUrl}&title=${encTitle}`, "_blank", "noopener,noreferrer"),
    },
    {
      name: "Email",
      icon: <Mail className="h-6 w-6 text-white" />,
      bg: "bg-[#5C6BC0]",
      onClick: () => { window.location.href = `mailto:?subject=${encTitle}&body=${encUrl}`; },
    },
    {
      name: "Copy",
      icon: <Link2 className="h-6 w-6 text-white" />,
      bg: "bg-zinc-600",
      onClick: handleCopy,
    },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200] bg-black/60" onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-[201] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md">
        <div
          className="rounded-t-2xl sm:rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-white">Share</h3>
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex items-center mb-5">
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer -ml-1"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1 py-2"
            >
              {platforms.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    p.onClick();
                    if ("tooltip" in p && p.tooltip) {
                      toast.success(p.tooltip as string);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer shrink-0"
                  aria-label={`Share via ${p.name}`}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${p.bg} transition-transform group-hover:scale-110`}>
                    {p.icon}
                  </span>
                  <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">{p.name}</span>
                </button>
              ))}
            </div>
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer -mr-1"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-[#0a0a0a] border border-white/10 p-2">
            <input
              ref={inputRef}
              type="text"
              value={url}
              readOnly
              className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate px-1"
              onFocus={() => inputRef.current?.select()}
            />
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md bg-[#E1B94D] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#d4a639] transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
