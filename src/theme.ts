import { createTheme } from "@mui/material/styles";

// Single source of truth for the Material UI theme.
// `colorSchemes.dark` lets Material UI follow the user's system preference for
// light/dark mode and expose the matching colours through `theme.palette`.
export const theme = createTheme({
  colorSchemes: {
    dark: true,
  },
});
