import React from "react";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Toolbar from "@mui/material/Toolbar";
import { ThemeProvider } from "@mui/material/styles";
import { connect, ConnectedProps } from "react-redux";
import "./App.css";
import NavBar from "./components/NavBar";
import OutputArea from "./components/OutputArea";
import BigTextBox from "./components/BigTextBox";
import { contentShiftSx, contentSx } from "./layoutStyles";
import { RootState } from "./store";
import { theme } from "./theme";

const mapStateToProps = (state: RootState) => ({
  fontFaces: state.crowbar.fonts
    .map((font) => font.fontFace)
    .filter((fontFace): fontFace is string => Boolean(fontFace)),
  drawerOpen: state.crowbar.drawerOpen,
});

const connector = connect(mapStateToProps, {});
type PropsFromRedux = ConnectedProps<typeof connector>;

function Component({ fontFaces, drawerOpen }: PropsFromRedux) {
  return (
    <div>
      <style>{fontFaces.join("\n")}</style>
      <CssBaseline />
      <NavBar />
      <Box component="main" sx={[contentSx, drawerOpen && contentShiftSx]}>
        <Toolbar />
        <BigTextBox />
        <OutputArea />
      </Box>
    </div>
  );
}

const App = (props: PropsFromRedux) => (
  <ThemeProvider theme={theme}>
    <Component {...props} />
  </ThemeProvider>
);

export default connector(App);
