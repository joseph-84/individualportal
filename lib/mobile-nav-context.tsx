"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const MobileNavContext = createContext<{ open: boolean; toggle: () => void; close: () => void } | null>(null);

/** Drives the sidebar's mobile off-canvas drawer. Separate from ThemeProvider since it's only
 * needed inside the authenticated portal layout, not on the public login/share pages. */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation so tapping a nav link doesn't leave it open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <MobileNavContext.Provider value={{ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
