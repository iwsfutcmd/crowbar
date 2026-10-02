import React from "react";
import { connect, ConnectedProps } from "react-redux";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import ListSubheader from "@mui/material/ListSubheader";
import Checkbox from "@mui/material/Checkbox";
import {
  changedDrawerState,
  changedVariations,
  changedDirection,
  changedScript,
  changedLanguage,
  changedFeatureState,
  changedClusterLevel,
  changedFeatureString,
  changedBufferFlag,
  changedShowAllLookups,
  changedEngine,
} from "../store/crowbarSlice";
import { ENGINES, getEngine } from "../engines";
import { RootState } from "../store";
import { CrowbarFont } from "../opentype/CrowbarFont";
import {
  chipArraySx,
  drawerHeaderSx,
  drawerPaperSx,
  drawerSx,
  flagSx,
  formControlSx,
  smallSpaceSx,
} from "../layoutStyles";
import { harfbuzzScripts, opentypeLanguages } from "../opentype/constants";
import { hbSingleton } from "../opentype/CrowbarFont";

const mapStateToProps = (state: RootState) => {
  // console.log("Mapping state to props", state);
  return {
    open: state.crowbar.drawerOpen,
    fonts: state.crowbar.fonts,
    selectedFontIndex: state.crowbar.selected_font,
    featureState: state.crowbar.features,
    featureString: state.crowbar.featureString,
    clusterLevel: state.crowbar.clusterLevel,
    variations: state.crowbar.variations,
    direction: state.crowbar.direction,
    script: state.crowbar.script,
    language: state.crowbar.language,
    bufferFlag: state.crowbar.bufferFlag || [],
    showAllLookups: state.crowbar.showAllLookups,
    engine: state.crowbar.engine,
  };
};

const connector = connect(mapStateToProps, {
  changedDirection,
  changedScript,
  changedLanguage,
  changedDrawerState,
  changedVariations,
  changedFeatureState,
  changedClusterLevel,
  changedFeatureString,
  changedBufferFlag,
  changedShowAllLookups,
  changedEngine,
});
type PropsFromRedux = ConnectedProps<typeof connector>;

const MyDrawer = (props: PropsFromRedux) => {
  const handleDrawerClose = () => {
    props.changedDrawerState(false);
  };
  const handleVariationChange = (tag: string, value: number) => {
    const state = props.variations;
    props.changedVariations({ ...state, [tag]: value });
  };
  const font: CrowbarFont = (props.fonts || [])[props.selectedFontIndex];
  const sortLanguages = (
    a: Record<"label" | "tag", string>,
    b: Record<"label" | "tag", string>
  ) => {
    if (!font) {
      return a.label.localeCompare(b.label);
    }
    if (
      font.supportedLanguages.has(a.tag) &&
      !font.supportedLanguages.has(b.tag)
    ) {
      return -1;
    }
    if (
      font.supportedLanguages.has(b.tag) &&
      !font.supportedLanguages.has(a.tag)
    ) {
      return 1;
    }
    return a.label.localeCompare(b.label);
  };
  const sortScripts = (
    a: Record<"label" | "tag", string>,
    b: Record<"label" | "tag", string>
  ) => {
    if (!font) {
      return a.label.localeCompare(b.label);
    }
    if (
      font.supportedScripts.has(a.tag.toLowerCase()) &&
      !font.supportedScripts.has(b.tag.toLowerCase())
    ) {
      return -1;
    }
    if (
      font.supportedScripts.has(b.tag.toLowerCase()) &&
      !font.supportedScripts.has(a.tag.toLowerCase())
    ) {
      return 1;
    }
    return a.label.localeCompare(b.label);
  };
  const featureStateColor = (x: string) => {
    if (!(x in props.featureState)) {
      return "default";
    }
    if (props.featureState[x]) {
      return "primary";
    }
    return "secondary";
  };
  const featureStateIcon = (x: string) => {
    if (!(x in props.featureState)) {
      return <span />;
    }
    if (props.featureState[x]) {
      return <CheckCircleIcon />;
    }
    return <CancelIcon />;
  };

  let features;
  if (font) {
    features = (
      <div>
        <Box component="h2" sx={smallSpaceSx}>
          Features
        </Box>
        <TextField
          id="featurestring"
          label="Features"
          onChange={(e) => {
            props.changedFeatureString(e.target.value);
          }}
        />
        {!props.featureString && (
          <Box sx={chipArraySx}>
            {font.allFeatureTags().map((x) => (
              <Chip
                key={x}
                onClick={() => {
                  props.changedFeatureState(x);
                }}
                color={featureStateColor(x)}
                icon={featureStateIcon(x)}
                label={x}
              />
            ))}
          </Box>
        )}
      </div>
    );
  }
  let axes;
  if (font && font.axes) {
    axes = (
      <FormControl sx={formControlSx}>
        <Box component="h2" sx={smallSpaceSx}>
          Variation Axes
        </Box>
        {Object.entries(font.axes).map(([axistag, axis]) => (
          <div key={axistag}>
            <Typography>{axistag}</Typography>
            <Slider
              value={
                typeof props.variations[axistag] === "number"
                  ? props.variations[axistag]
                  : axis.default
              }
              min={axis.min}
              max={axis.max}
              valueLabelDisplay="auto"
              aria-labelledby="input-slider"
              onChange={(e, v) => handleVariationChange(axistag, v)}
            />
          </div>
        ))}
      </FormControl>
    );
  }

  return (
    <Drawer
      sx={drawerSx}
      variant="persistent"
      anchor="right"
      open={props.open}
      slotProps={{ paper: { sx: drawerPaperSx } }}
    >
      <Box sx={drawerHeaderSx}>
        <IconButton onClick={handleDrawerClose}>
          {document.dir == "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <FormControl sx={formControlSx}>
        <InputLabel id="engine-label">Shaping engine</InputLabel>
        <Select
          labelId="engine-label"
          id="engine"
          label="Shaping engine"
          value={props.engine}
          onChange={(e) => props.changedEngine(e.target.value as string)}
        >
          <ListSubheader>In your browser</ListSubheader>
          {ENGINES.filter((e) => e.location === "browser").map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name}
            </MenuItem>
          ))}
          <ListSubheader>Native, via GitHub Actions</ListSubheader>
          {ENGINES.filter((e) => e.location === "native").map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" sx={{ mt: 0.5 }}>
          {getEngine(props.engine).description}
        </Typography>
      </FormControl>
      <Divider />

      <FormControl sx={formControlSx}>
        <InputLabel id="direction-label">Direction</InputLabel>
        <Select
          labelId="direction-label"
          id="direction"
          value={props.direction}
          onChange={(e) => props.changedDirection(e.target.value as string)}
        >
          <MenuItem value="auto">Automatically detect</MenuItem>
          <MenuItem value="ltr">Left to right</MenuItem>
          <MenuItem value="rtl">Right to left</MenuItem>
          <MenuItem value="ttb">Top to bottom</MenuItem>
        </Select>
      </FormControl>
      <Divider />

      <Autocomplete
        freeSolo
        id="script"
        options={harfbuzzScripts.sort(sortScripts)}
        renderOption={({ key, ...optionProps }, option) => (
          <Box component="li" key={key} {...optionProps}>
            <Box component="span" sx={flagSx}>
              {font && font.supportedScripts.has(option.tag.toLowerCase())
                ? "✅"
                : " "}
            </Box>
            {option.label}
          </Box>
        )}
        getOptionLabel={(option) => {
          if (typeof option === "string") {
            return option;
          }
          return option.label;
        }}
        onChange={(e, v) => {
          if (!v) {
            return props.changedScript("");
          }
          if (typeof v === "string") {
            return props.changedScript(v);
          }
          return props.changedScript(v.tag);
        }}
        renderInput={(params) => (
          <TextField {...params} label="Script" variant="outlined" />
        )}
      />
      <Autocomplete
        freeSolo
        id="language"
        options={opentypeLanguages.sort(sortLanguages)}
        renderOption={({ key, ...optionProps }, option) => (
          <Box component="li" key={key} {...optionProps}>
            <Box component="span" sx={flagSx}>
              {font && font.supportedLanguages.has(option.tag) ? "✅" : " "}
            </Box>
            {option.label}
          </Box>
        )}
        getOptionLabel={(option) => {
          if (typeof option === "string") {
            return option;
          }
          return option.label;
        }}
        onChange={(e, v) => {
          if (!v) {
            return props.changedLanguage("");
          }
          if (typeof v === "string") {
            return props.changedLanguage(v);
          }
          return props.changedLanguage(v.tag);
        }}
        renderInput={(params) => (
          <TextField {...params} label="Language" variant="outlined" />
        )}
      />
      <Divider />
      {features}
      {axes && <Divider />}
      {axes}
      <Divider />

      <FormControl sx={formControlSx}>
        <InputLabel id="cluster-level-label">Clustering</InputLabel>
        <Select
          labelId="cluster-level-label"
          id="cluster-level"
          value={props.clusterLevel}
          onChange={(e) => props.changedClusterLevel(e.target.value as number)}
        >
          <MenuItem value={0}>Monotone graphemes</MenuItem>
          <MenuItem value={1}>Monotone characters</MenuItem>
          <MenuItem value={2}>Characters</MenuItem>
        </Select>
      </FormControl>
      <FormControl sx={formControlSx}>
        <InputLabel id="buffer-flag-label">Buffer Flags</InputLabel>
        <Select
          labelId="buffer-flag-label"
          id="buffer-flag"
          multiple
          value={props.bufferFlag}
          onChange={(e) => props.changedBufferFlag(e.target.value as string[])}
        >
          <MenuItem value="BOT">Beginning of text paragraph</MenuItem>
          <MenuItem value="EOT">End of text paragraph</MenuItem>
          <MenuItem value="PRESERVE_DEFAULT_IGNORABLES">
            Preserve default ignorables
          </MenuItem>
          <MenuItem value="REMOVE_DEFAULT_IGNORABLES">
            Remove default ignorables
          </MenuItem>
          <MenuItem value="DO_NOT_INSERT_DOTTED_CIRCLE">
            Do not insert dotted circle
          </MenuItem>
        </Select>
      </FormControl>
      <FormControl sx={formControlSx}>
        <FormControlLabel
          control={
            <Checkbox
              name="show-all-lookups"
              checked={props.showAllLookups}
              value={props.showAllLookups}
              onChange={() => {
                props.changedShowAllLookups(!props.showAllLookups);
              }}
            />
          }
          label="Show All Lookups"
        />
        <div>
          {hbSingleton
            ? `HarfBuzz version ${hbSingleton.versionString()}`
            : "Unknown version of HarfBuzz"}
        </div>
      </FormControl>
    </Drawer>
  );
};

export default connector(MyDrawer);
