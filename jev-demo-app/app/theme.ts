"use client";

import { createTheme } from "@mui/material/styles";

// One shape scale, used everywhere:
//   controls (buttons, inputs, chips, menus) 8px · nested panels/alerts 12px · cards 16px · dialogs 20px
// Light/dark follow the OS setting (media selector) so the chart CSS tokens in globals.css stay in sync.
export const RADIUS = { control: 8, panel: 12, card: 16, dialog: 20 } as const;

const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1a73e8" },
        secondary: { main: "#d9531e" },
        background: { default: "#f4f6fa", paper: "#ffffff" },
        divider: "#dfe3e8",
      },
    },
    dark: {
      palette: {
        primary: { main: "#8ab4f8" },
        secondary: { main: "#f28b5b" },
        background: { default: "#131314", paper: "#1e1f20" },
        divider: "#3c4043",
      },
    },
  },
  typography: {
    fontFamily: "var(--font-roboto), Roboto, system-ui, sans-serif",
    h4: { fontWeight: 500, letterSpacing: "-0.01em" },
    h6: { fontWeight: 500, fontSize: "1.1rem" },
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
  },
  shape: { borderRadius: RADIUS.control },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, rounded: { borderRadius: RADIUS.panel } } },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: RADIUS.card, backgroundImage: "none" } },
    },
    MuiCardHeader: { styleOverrides: { root: { padding: "20px 20px 0" }, subheader: { marginTop: 2 } } },
    MuiCardContent: { styleOverrides: { root: { padding: 20, "&:last-child": { paddingBottom: 20 } } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: RADIUS.control, minHeight: 40, paddingInline: 16 },
        sizeLarge: { minHeight: 44, paddingInline: 20, fontSize: "0.95rem" },
        sizeSmall: { minHeight: 32 },
        outlined: { borderWidth: 1 },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: RADIUS.control } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: RADIUS.control } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: RADIUS.control, fontWeight: 500 },
        sizeSmall: { borderRadius: 6 },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: RADIUS.panel, alignItems: "center" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: RADIUS.dialog } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: RADIUS.control } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 6 } } },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, height: 6 }, bar: { borderRadius: 999 } },
    },
    MuiSlider: { styleOverrides: { markLabel: { display: "none" }, mark: { width: 2, height: 10, borderRadius: 1 } } },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: "3px 3px 0 0" } } },
    MuiTab: { styleOverrides: { root: { minHeight: 52, fontWeight: 500 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600 } } },
    MuiSwitch: { defaultProps: { color: "primary" } },
  },
});

export default theme;
