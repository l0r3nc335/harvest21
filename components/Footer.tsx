import Image from "next/image";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-[50px] w-full bg-[#0A0A0A] border-t border-zinc-800" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-8 lg:grid-cols-3">
            <div className="col-span-2 flex items-center lg:col-span-1">
              <div className="cursor-default" aria-label="Harvest 21 Logo">
                <Image
                  src="/logo.svg"
                  alt="Harvest 21"
                  width={157}
                  height={30}
                  className="h-8 w-auto"
                  priority={false}
                />
              </div>
            </div>

            <nav className="space-y-4" aria-label="Footer Navigation A">
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/about-us"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/statement-of-faith"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    Statement of Faith
                  </Link>
                </li>
                <li>
                  <Link
                    href="/donate"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    Donate
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    FAQ
                  </Link>
                </li>
              </ul>
            </nav>

            <nav className="space-y-4" aria-label="Footer Navigation B">
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/contact-us"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy-policy"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms-of-use"
                    className="text-sm text-zinc-400 hover:text-brand-yellow transition-colors focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-[#0A0A0A] rounded"
                  >
                    Terms of Use
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="border-t border-zinc-800 py-6 sm:py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Copyright &copy; {currentYear} Harvest 21
            </p>
            <p className="text-xs text-zinc-500">
              Harvest 21 is a qualified IRS Section 501(c)(3) Organization
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

