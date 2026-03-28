"use client";

import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb" },
    secondary: { main: "#7c3aed" },
    background: {
      default: "#f0f4f8",
      paper: "rgba(255,255,255,0.82)",
    },
    text: {
      primary: "#0f172a",
      secondary: "#334155",
      disabled: "#94a3b8",
    },
    divider: "rgba(0,0,0,0.08)",
  },
  typography: {
    fontFamily: "'DM Sans', Inter, -apple-system, sans-serif",
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f0f4f8",
          overflow: "hidden",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderColor: "rgba(0,0,0,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: "rgba(0,0,0,0.12)",
          color: "#334155",
          fontSize: "12px",
          backdropFilter: "blur(8px)",
          "&:hover": {
            backgroundColor: "rgba(37,99,235,0.10)",
            color: "#1e40af",
            borderColor: "rgba(37,99,235,0.4)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: "#0f172a",
          backgroundColor: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(12px)",
          "& fieldset": { borderColor: "rgba(0,0,0,0.14)" },
          "&:hover fieldset": { borderColor: "rgba(37,99,235,0.5)" },
          "&.Mui-focused fieldset": { borderColor: "#2563eb" },
        },
        input: {
          "&::placeholder": { color: "#94a3b8", opacity: 1 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "rgba(0,0,0,0.06)" },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "rgba(0,0,0,0.08)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.10)",
          fontSize: 11,
          fontWeight: 600,
          color: "#f8fafc",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        },
      },
    },
  },
});

export default function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
