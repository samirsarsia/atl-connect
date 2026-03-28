"use client";

import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary:   { main: "#3b82f6" },
    secondary: { main: "#a78bfa" },
    background: {
      default: "#0f1117",
      paper:   "#1e2028",
    },
    text: {
      primary:   "#e4e4e7",
      secondary: "#a1a1aa",
      disabled:  "#52525b",
    },
    divider: "#2a2d37",
  },
  typography: {
    fontFamily: "Inter, -apple-system, sans-serif",
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#0f1117",
          overflow: "hidden",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#1e2028",
          borderColor: "#2a2d37",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: "#2a2d37",
          color: "#a1a1aa",
          fontSize: "12px",
          "&:hover": {
            backgroundColor: "#2a2d37",
            color: "#e4e4e7",
            borderColor: "#3b82f6",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: "#e4e4e7",
          "& fieldset": { borderColor: "#2a2d37" },
          "&:hover fieldset": { borderColor: "#3b82f6" },
          "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
        },
        input: {
          "&::placeholder": { color: "#52525b", opacity: 1 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "#2a2d37" },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: "#2a2d37" },
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
