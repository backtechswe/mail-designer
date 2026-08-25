import type { CSSProperties } from "react";
import type { ColorScheme, DesignerTheme } from "../types.js";

/**
 * The theme prop becomes CSS custom properties on the root element. That is the entire
 * theming mechanism — no CSS-in-JS, no class names for a host app to override, and no
 * specificity war. A value left undefined simply falls through to the default in
 * styles.css, so a host can restyle one token without restating the rest.
 */
export function themeToStyle(theme?: DesignerTheme): CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  const set = (name: string, value: string | number | undefined): void => {
    if (value === undefined) return;
    vars[name] = typeof value === "number" ? `${value}px` : value;
  };

  set("--md-accent", theme.accent);
  set("--md-accent-contrast", theme.accentContrast);
  set("--md-accent-soft", theme.accentSoft);
  set("--md-bg", theme.bg);
  set("--md-bg-subtle", theme.bgSubtle);
  set("--md-bg-sunken", theme.bgSunken);
  set("--md-border", theme.border);
  set("--md-border-strong", theme.borderStrong);
  set("--md-text", theme.text);
  set("--md-text-muted", theme.textMuted);
  set("--md-danger", theme.danger);
  set("--md-radius", theme.radius);
  set("--md-space", theme.space);
  set("--md-font", theme.fontFamily);
  set("--md-font-mono", theme.fontFamilyMono);
  set("--md-lift", theme.lift);

  return vars as CSSProperties;
}

/**
 * "system" resolves in CSS, not here, so the editor follows a change of OS appearance
 * without a re-render. Returning undefined leaves the attribute off the element, which is
 * what the media query in styles.css keys on.
 */
export function resolveColorScheme(scheme: ColorScheme = "system"): "light" | "dark" | undefined {
  return scheme === "system" ? undefined : scheme;
}
