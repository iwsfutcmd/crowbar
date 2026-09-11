import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

/**
 * A single (non-array) `sx` rule. `SxProps` itself allows arrays, which makes it
 * awkward to nest several rules together in `sx={[...]}`; components compose
 * these individual rules instead.
 *
 * NOTE: inside `sx`, numbers on spacing properties (`margin*`, `padding*`, `top`,
 * `left`, ...) are multiplied by `theme.spacing(1)`, so anything that is not an
 * 8px multiple has to be written as an explicit `px` string.
 */
type Style =
  | SystemStyleObject<Theme>
  | ((theme: Theme) => SystemStyleObject<Theme>);

// Shared layout metrics and styles for the application shell.
//
// These were previously split between `navbarstyles.ts` (a `makeStyles` hook)
// and `App.tsx` (a second `makeStyles` hook), which duplicated the drawer width
// and the main content margins. They now live in one place as plain `sx` style
// objects so every component shares exactly the same values.

export const drawerWidth = 240;

export const appBarSx: Style = (theme) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
});

export const appBarShiftSx: Style = (theme) => ({
  width: `calc(100% - ${drawerWidth}px)`,
  marginRight: `${drawerWidth}px`,
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  }),
});

export const draggingSx: Style = (theme) => ({
  backgroundColor: theme.palette.info.light,
});

export const growSx: Style = { flexGrow: 1 };

export const smallSpaceSx: Style = (theme) => ({
  padding: theme.spacing(2),
});

export const tinySpaceSx: Style = (theme) => ({
  padding: theme.spacing(1),
});

export const hideSx: Style = { display: "none" };

export const flagSx: Style = { width: 30 };

export const contentSx: Style = (theme) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginRight: `-${drawerWidth}px`,
});

export const contentShiftSx: Style = (theme) => ({
  marginRight: 0,
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.easeOut,
    duration: theme.transitions.duration.enteringScreen,
  }),
});

export const drawerSx: Style = { width: drawerWidth, flexShrink: 0 };

export const drawerPaperSx: Style = { width: drawerWidth };

export const drawerHeaderSx: Style = (theme) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: theme.spacing(0, 1),
});

export const chipArraySx: Style = (theme) => ({
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  "& > *": {
    margin: theme.spacing(0.5),
  },
});

export const formControlSx: Style = (theme) => ({
  margin: theme.spacing(1),
  minWidth: 120,
});
