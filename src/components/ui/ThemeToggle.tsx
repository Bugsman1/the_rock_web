import { useState } from "react";
import { applyTheme, currentTheme, storeTheme } from "@/lib/theme";
import { IconButton } from "./IconButton";

export function ThemeToggle({ label }: { label: string }) {
  const [theme, setTheme] = useState(currentTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";

    applyTheme(next);
    storeTheme(next);
    setTheme(next);
  }

  return <IconButton icon="moon" label={label} aria-pressed={theme === "dark"} onClick={toggle} />;
}
