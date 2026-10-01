"use client";

import { createTheme } from "@mui/material/styles";

// One shape scale, used everywhere:
//   controls (buttons, inputs, chips, menus) 8px · nested panels/alerts 12px · cards 16px · dialogs 20px
// Light/dark follow the OS setting (media selector) so the chart CSS tokens in globals.css stay in sync.
export const RADIUS = { control: 8, panel: 12, card: 16, dialog: 20 } as const;

// Surfaces are separated by a hairline ring + soft shadow instead of visible outlines.
const RING_LIGHT = "0 0 0 1px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -8px rgba(15, 23, 42, 0.10)";
const RING_DARK = "0 0 0 1px rgba(255, 255, 255, 0.07)";

const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1a73e8" },
        secondary: { main: "#d9531e" },
        background: { default: "#f5f6f8", paper: "#ffffff" },
        text: { primary: "#0f172a", secondary: "#5b6474" },
        divider: "#e6e8ec",
      },
    },
    dark: {
      palette: {
        primary: { main: "#8ab4f8" },
        secondary: { main: "#f28b5b" },
        background: { default: "#0f1012", paper: "#18191c" },
        text: { primary: "#eceef1", secondary: "#a1a7b3" },
        divider: "#2a2c31",
      },
    },
  },
  typography: {
    fontFamily: "var(--font-sans), Inter, system-ui, -apple-system, sans-serif",
    h3: { fontWeight: 600, letterSpacing: "-0.035em", fontSize: "2.6rem", lineHeight: 1.05 },
    h4: { fontWeight: 650, letterSpacing: "-0.03em", fontSize: "2rem", lineHeight: 1.15 },
    h5: { fontWeight: 600, letterSpacing: "-0.02em" },
    h6: { fontWeight: 600, letterSpacing: "-0.01em", fontSize: "1.05rem" },
    subtitle1: { fontWeight: 600, letterSpacing: "-0.01em" },
    subtitle2: { fontWeight: 600 },
    body2: { fontSize: "0.875rem" },
    overline: { fontWeight: 600, letterSpacing: "0.08em", fontSize: "0.7rem" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  shape: { borderRadius: RADIUS.control },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", fontFeatureSettings: '"cv11", "ss01"' } },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        rounded: { borderRadius: RADIUS.panel },
        // "outlined" papers are nested panels: a soft fill, no hard border
        outlined: ({ theme }) => ({
          border: `1px solid ${theme.vars?.palette.divider}`,
        }),
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: RADIUS.card, backgroundImage: "none", border: 0, boxShadow: RING_LIGHT,
          ...theme.applyStyles("dark", { boxShadow: RING_DARK }),
        }),
      },
    },
    MuiCardContent: { styleOverrides: { root: { padding: 24, "&:last-child": { paddingBottom: 24 } } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: RADIUS.control, minHeight: 40, paddingInline: 16 },
        sizeLarge: { minHeight: 44, paddingInline: 20, fontSize: "0.95rem" },
        sizeSmall: { minHeight: 32 },
        outlined: ({ theme }) => ({ borderColor: theme.vars?.palette.divider, borderWidth: 1 }),
        contained: { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(15,23,42,0.15)" },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: RADIUS.control } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: RADIUS.control,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: theme.vars?.palette.divider },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.vars?.palette.text.secondary },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: RADIUS.control, fontWeight: 500 },
        sizeSmall: { borderRadius: 6, fontSize: "0.75rem", height: 24 },
        outlined: ({ theme }) => ({ borderColor: theme.vars?.palette.divider }),
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: RADIUS.panel, alignItems: "center" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: RADIUS.dialog } } },
    MuiBackdrop: { styleOverrides: { root: { backdropFilter: "blur(2px)" } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: RADIUS.control } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 6, fontSize: "0.75rem" } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, height: 4 }, bar: { borderRadius: 999 } } },
    MuiSlider: { styleOverrides: { markLabel: { display: "none" }, mark: { width: 2, height: 10, borderRadius: 1 }, thumb: { width: 16, height: 16 } } },
    MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 48, fontWeight: 500, textTransform: "none", fontSize: "0.9rem" } } },
    MuiToggleButtonGroup: {
      styleOverrides: {
        // segmented control: soft track, selected segment lifts
        root: ({ theme }) => ({
          backgroundColor: theme.vars?.palette.action.hover, padding: 3, borderRadius: RADIUS.control + 2, gap: 2,
          "& .MuiToggleButtonGroup-grouped": { border: 0, borderRadius: `${RADIUS.control}px !important`, margin: 0 },
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: "none", fontWeight: 500, color: theme.vars?.palette.text.secondary, paddingBlock: 5,
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: theme.vars?.palette.background.paper, color: theme.vars?.palette.text.primary,
            boxShadow: "0 1px 2px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04)",
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.vars?.palette.divider }),
        head: ({ theme }) => ({ fontWeight: 600, fontSize: "0.75rem", color: theme.vars?.palette.text.secondary, textTransform: "uppercase", letterSpacing: "0.04em" }),
      },
    },
    MuiSwitch: { defaultProps: { color: "primary" } },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: "rgba(255,255,255,0.75)", backdropFilter: "saturate(180%) blur(12px)",
          ...theme.applyStyles("dark", { backgroundColor: "rgba(15,16,18,0.75)" }),
        }),
      },
    },
  },
});

export default theme;
