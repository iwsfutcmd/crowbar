import React from "react";
import Input from "@mui/material/Input";
import { connect, ConnectedProps } from "react-redux";
import { changedTextAction } from "../store/crowbarSlice";
import { CrowbarFont } from "../opentype/CrowbarFont";
import { RootState } from "../store";

const mapStateToProps = (state: RootState) => {
  const font: CrowbarFont = state.crowbar.fonts[state.crowbar.selected_font];
  return { font };
};

const connector = connect(mapStateToProps, { changedTextAction });
type PropsFromRedux = ConnectedProps<typeof connector>;

const BigTextBox = (props: PropsFromRedux) => {
  const { font, changedTextAction: connectedChangedTextAction } = props;
  let restyle;
  if (font) {
    restyle = { fontFamily: `"${font.name}"` } as React.CSSProperties;
  }
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    connectedChangedTextAction(value);
  };
  return (
    <Input
      sx={{ backgroundColor: "background.paper", padding: 1 }}
      style={restyle}
      onChange={handleChange}
      placeholder="ABC abc"
      id="inputtext"
    />
  );
};

export default connector(BigTextBox);
