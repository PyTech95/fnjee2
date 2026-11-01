import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, Menu, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";

export default function AppShell({ nav, brandLabel = "FNJEE.com", accent = "admin" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const initials = (user?.name || "U").split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
  const bottomNav = nav.slice(0, 4);

  const NavItem = ({ n, onClick }) => (
    <NavLink
      to={n.to}
      end={n.end}
      onClick={onClick}
      data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
          isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted hover:text-foreground"
        }`
      }
    >
      <n.icon className="h-4 w-4" />
      <span>{n.label}</span>
    </NavLink>
  );

  const brandMark = (
    <div className="flex items-center gap-2">
      <img src="/icon-192.png" alt="FNJEE.com" className="h-9 w-9 rounded-xl" />
      <div>
        <div className="font-display font-bold text-lg tracking-tight leading-none">{brandLabel}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{accent}</div>
      </div>
    </div>
  );

  return (
    <div data-testid="app-shell" className="min-h-screen flex bg-background text-foreground">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card/50">
        <div className="p-6">{brandMark}</div>
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto en-scroll">
          {nav.map((n) => <NavItem key={n.to} n={n} />)}
        </nav>
        <div className="p-4 text-xs text-muted-foreground border-t border-border">v1.2 · FNJEE.com PWA</div>
      </aside>

      {/* main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            {/* mobile: hamburger + brand */}
            <div className="lg:hidden flex items-center gap-2">
              <Sheet open={drawer} onOpenChange={setDrawer}>
                <SheetTrigger asChild>
                  <Button data-testid="mobile-nav-btn" variant="ghost" size="icon" className="rounded-full -ml-1"><Menu className="h-5 w-5" /></Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="p-5 border-b border-border text-left">
                    <SheetTitle asChild><div>{brandMark}</div></SheetTitle>
                  </SheetHeader>
                  <nav className="p-3 space-y-1 overflow-y-auto en-scroll" style={{ maxHeight: "calc(100vh - 90px)" }}>
                    {nav.map((n) => <NavItem key={n.to} n={n} onClick={() => setDrawer(false)} />)}
                  </nav>
                </SheetContent>
              </Sheet>
              <img src="/icon-192.png" alt="FNJEE.com" className="h-8 w-8 rounded-lg" />
              <span className="font-display font-semibold truncate max-w-[9rem]">{brandLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button data-testid="toggle-theme" variant="ghost" size="icon" className="rounded-full" onClick={() => setDark(d => !d)}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="user-menu-btn" variant="ghost" className="rounded-full pl-2 pr-3 gap-2 h-10">
                    <Avatar className="h-8 w-8"><AvatarImage src={user?.avatar} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                    <div className="text-left hidden sm:block">
                      <div className="text-sm font-medium leading-none">{user?.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="privacy-item" onClick={() => navigate("/privacy")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Privacy policy
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="delete-account-item" className="text-destructive focus:text-destructive" onClick={() => navigate("/delete-account")}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="logout-item" onClick={() => { logout(); navigate("/"); }}>
                    <LogOut className="h-4 w-4 mr-2" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto en-scroll">
          <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full pb-24 lg:pb-10">
            <Outlet />
          </div>
        </main>
      </div>

      {/* mobile bottom tab bar (native app feel) */}
      <nav data-testid="mobile-bottom-nav" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {bottomNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {({ isActive }) => (<>
                <n.icon className={`h-5 w-5 ${isActive ? "scale-110" : ""} transition-transform`} />
                <span className="truncate max-w-[64px]">{n.label}</span>
              </>)}
            </NavLink>
          ))}
          <button onClick={() => setDrawer(true)} data-testid="bottom-more-btn"
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
