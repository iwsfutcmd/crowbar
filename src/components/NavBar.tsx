import React, { useCallback } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import { useDropzone } from "react-dropzone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { connect, ConnectedProps } from "react-redux";
import IconButton from "@mui/material/IconButton";
import FontSelect from "./FontSelect";
import {
  appBarShiftSx,
  appBarSx,
  draggingSx,
  growSx,
  hideSx,
  smallSpaceSx,
  tinySpaceSx,
} from "../layoutStyles";
import { addedFontAction, changedDrawerState } from "../store/crowbarSlice";
import MyDrawer from "./MyDrawer";
import { RootState } from "../store";

const mapStateToProps = (state: RootState) => ({
  open: state.crowbar.drawerOpen,
});

const connector = connect(mapStateToProps, {
  addedFontAction,
  changedDrawerState,
});
type PropsFromRedux = ConnectedProps<typeof connector>;

const NavBar = (props: PropsFromRedux) => {
  const [shaking, setShaking] = React.useState(false);
  const { open } = props;

  const action = props.addedFontAction;
  const handleDrawerOpen = () => {
    props.changedDrawerState(true);
  };
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const name = acceptedFiles[0].name.toLowerCase();
      if (
        !name.endsWith(".otf") &&
        !name.endsWith(".ttf") &&
        !name.endsWith(".ttc") &&
        !name.endsWith(".otc")
      ) {
        setShaking(true);
      } else {
        action(acceptedFiles[0]);
      }
    },
    [action]
  );

  const { getRootProps, getInputProps, isDragAccept } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <AppBar
        position="fixed"
        className={shaking ? "shake" : undefined}
        sx={[appBarSx, open && appBarShiftSx, isDragAccept && draggingSx]}
        onAnimationEnd={() => setShaking(false)}
      >
        <Toolbar>
          <Typography variant="h6" noWrap>
            Crowbar
          </Typography>
          <Box sx={smallSpaceSx} />
          <CloudUploadIcon />
          <Box sx={tinySpaceSx} />
          <Box sx={growSx}>
            <FontSelect />
          </Box>
          <Box sx={smallSpaceSx} />
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerOpen}
            sx={open ? hideSx : undefined}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <MyDrawer />
    </div>
  );
};
export default connector(NavBar);
