import { Logo } from "./Logo";

const JACE = "https://jaceo.vercel.app";
// The READ ME forum topics that hold Jace's published Terms and Privacy Policy.
const TERMS = `${JACE}/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/7a9f0277-e85e-44f2-91da-353a1b3b3451`;
const PRIVACY = `${JACE}/forums/7b1b592b-ae13-4094-be3c-b18f95d1d347/3e462dc4-1734-400a-8ca6-66a80ff32ac7`;

const linkClass =
  "rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-foreground/[.05] hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size={24} />
          <div>
            <p className="text-sm font-semibold">Jace Games</p>
            <p className="text-xs text-muted">From Jace, a company that makes stuff.</p>
          </div>
        </div>
        <nav className="-mx-3 flex flex-wrap items-center gap-1 text-sm sm:mx-0">
          <a href={JACE} className={linkClass}>
            Jace
          </a>
          <a href={TERMS} className={linkClass}>
            Terms of Service
          </a>
          <a href={PRIVACY} className={linkClass}>
            Privacy Policy
          </a>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-muted">© {new Date().getFullYear()} Jace</p>
    </footer>
  );
}
