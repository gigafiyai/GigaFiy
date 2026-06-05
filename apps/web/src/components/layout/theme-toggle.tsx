"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Dark is the default theme; this toggles a `.light` class on <html> and
// persists the choice. The no-flash script in the root layout applies it on load.
export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-sm text-text-medium hover:bg-surface-hover hover:text-text transition-colors duration-100"
      aria-label="Toggle theme"
    >
      {light ? <Moon size={15} strokeWidth={1.5} /> : <Sun size={15} strokeWidth={1.5} />}
      {light ? "Dark mode" : "Light mode"}
    </button>
  );
}
