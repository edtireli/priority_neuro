import React, { createContext, useMemo, useState, useEffect } from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

export const ColorModeContext = createContext({ mode: "dark", toggleColorMode: () => {} });

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("color-mode") || "dark");

  useEffect(() => {
    localStorage.setItem("color-mode", mode);
    document.body.classList.toggle("light-mode", mode === "light");
  }, [mode]);

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => {
      setMode((prev) => (prev === "light" ? "dark" : "light"));
    },
  }), [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          background: {
            default: mode === "dark" ? "#2f2f2f" : "#ffffff",
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
