import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNativeApp, dashboardFor } from "@/lib/native";
import { useState, useEffect } from "react";
import { Menu, X, ArrowUpRight, Monitor } from "lucide-react";

const NAV = [
  { to: "/courses", label: "Courses" },
  { to: "/neet", label: "NEET" },
  { to: "/jee", label: "JEE" },
  { to: "/olympiads", label: "Olympiads" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
];

export default function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { user, loading } = useAuth();
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Inside the Android / iOS app the marketing site (pricing, courses…) is skipped: the app is
  // for studying, and app stores don't allow selling outside their in-app purchase systems.
  if (isNativeApp()) {
    if (loading) return null;
    return <Navigate to={user ? dashboardFor(user.role) : "/login"} replace />;
  }

  return (
    <div data-testid="marketing-layout" className="min-h-screen bg-[#FAF7F2] text-[#09090B] flex flex-col" style={{ fontFamily: '"Satoshi", ui-sans-serif, system-ui, sans-serif' }}>
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl backdrop-saturate-150 border-b-[1.5px] border-[#09090B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0" data-testid="brand-link">
            <img src="/fnjee-logo.png" alt="FNJEE.com — Forum for NEET JEE" className="h-10 w-auto" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={`marketing-nav-${n.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-[#09090B] text-white" : "text-[#09090B]/70 hover:text-[#09090B] hover:bg-[#09090B]/5"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <a href="/demo" target="_blank" rel="noopener noreferrer"><button data-testid="header-demo-test" className="rounded-full px-4 py-2 text-sm font-semibold text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors inline-flex items-center gap-1.5"><Monitor className="h-4 w-4" /> Demo Test</button></a>
            <Link to="/login"><button data-testid="header-signin" className="rounded-full px-4 py-2 text-sm font-semibold text-[#09090B]/80 hover:text-[#09090B] hover:bg-[#09090B]/5 transition-colors">Sign in</button></Link>
            <Link to="/signup"><button data-testid="header-start-free" className="mkt-btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold">Start free mock <ArrowUpRight className="h-4 w-4" /></button></Link>
          </div>
          <button data-testid="mobile-menu-btn" className="lg:hidden p-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t-[1.5px] border-[#09090B]/10 bg-white">
            <div className="px-4 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-[#0A66C2] text-white" : "hover:bg-[#09090B]/5"}`}>
                  {n.label}
                </NavLink>
              ))}
              <a href="/demo" target="_blank" rel="noopener noreferrer" data-testid="mobile-demo-test"><button className="w-full text-left rounded-lg px-3 py-2 text-sm font-semibold text-[#0A66C2] hover:bg-[#0A66C2]/10 inline-flex items-center gap-2"><Monitor className="h-4 w-4" /> Demo Test</button></a>
              <div className="pt-2 flex gap-2">
                <Link to="/login" className="flex-1"><button className="w-full rounded-full border-[1.5px] border-[#09090B] py-2.5 text-sm font-semibold">Sign in</button></Link>
                <Link to="/signup" className="flex-1"><button className="w-full mkt-btn-primary py-2.5 text-sm font-semibold">Start free</button></Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="bg-[#0F172A] text-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-8">
          <div className="overflow-hidden">
            <div className="font-bold text-[18vw] leading-[0.8] tracking-tighter text-white/[0.06] select-none" style={{ fontFamily: '"Clash Display", sans-serif' }} aria-hidden="true">
              ACE THE EXAM
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-10 mt-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/icon-192.png" alt="FNJEE.com" className="h-8 w-8" />
                <span className="font-bold" style={{ fontFamily: '"Clash Display", sans-serif' }}>FNJEE.com</span>
              </div>
              <p className="text-sm text-white/50 max-w-xs">AI-powered CBT practice for JEE, NEET, Olympiads and competitive exams — used by aspirants across India.</p>
            </div>
            <FooterCol title="Exams" links={[
              { to: "/jee", label: "JEE Main & Advanced" },
              { to: "/neet", label: "NEET UG" },
              { to: "/olympiads", label: "Olympiads" },
              { to: "/govt-exams", label: "SSC / Banking / Govt" },
            ]} />
            <FooterCol title="Product" links={[
              { to: "/features", label: "Features" },
              { to: "/how-it-works", label: "How it works" },
              { to: "/pricing", label: "Pricing" },
              { to: "/results", label: "Results & testimonials" },
            ]} />
            <FooterCol title="Company" links={[
              { to: "/faq", label: "FAQ" },
              { to: "/contact", label: "Contact" },
              { to: "/cities", label: "Cities we serve" },
              { to: "/blog", label: "Blog" },
              { to: "/privacy", label: "Privacy policy" },
              { to: "/terms", label: "Terms of use" },
              { to: "/delete-account", label: "Delete account" },
            ]} />
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
            <div>© 2026 FNJEE.com — Serious CBT practice, joyfully delivered.</div>
            <div>Made in India · Trusted by aspirants in 12+ cities</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-3" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-white/80 hover:text-[#0A66C2] transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
