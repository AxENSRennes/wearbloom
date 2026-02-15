export const wearbloomTheme = {
  colors: {
    background: "#FFFFFF",
    surface: "#F7F7F7",
    "surface-elevated": "#FFFFFF",
    "text-primary": "#1A1A1A",
    "text-secondary": "#6B6B6B",
    "text-tertiary": "#A3A3A3",
    border: "#EBEBEB",
    accent: "#1A1A1A",
    "accent-highlight": "#E8C4B8",
    "accent-highlight-soft": "#F5EBE7",
    success: "#4CAF82",
    warning: "#E5A940",
    error: "#D45555",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
} as const;

export type WearbloomTheme = typeof wearbloomTheme;
