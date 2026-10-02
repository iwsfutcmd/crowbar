# Crowbar: A text shaping debugger

![Screenshot](crowbar.png)

Crowbar is an application for debugging the layout tables of an OpenType font. Designers and font engineers creating OpenType fonts with a large number of layout lookups will benefit from being able to visualize the effect of these lookups on a given piece of text.

Crowbar shows the steps that an OpenType shaping/layout engine goes through as it applies feature rules from a font to an input string and turns it into a set of glyphs to be laid out visually: first, characters are mapped to glyphs, then the shaper applies all the substitution rules from the GSUB table, and then the positioning rules. In the screenshot above, you can see that the shaper has just processed lookup 2 which is part of the `mark` feature, and the result of that feature has been to reposition the `TwoDotsAboveNS` glyph.

## To use Crowbar

You can see Crowbar in action at http://www.corvelsoftware.co.uk/crowbar/

To use it, drag an OTF font to the navigation bar. Crowbar runs entirely within the browser, and does not upload the font to any server. Next, enter some text in the text box. Crowbar will display a trace of the shaping operations taken to lay out the text. As you mouse over each row in the shaping trace, Crowbar will highlight the glyphs which have changed since the previous lookup application, and visualise the effect of the operations up until the given point.

OpenType features can be specified from the drawer on the right hand side. Crowbar lists all of the features defined in your font. Clicking once on a feature name will force a feature on; clicking again will force it off; clicking a third time will restore it to the default. You can also choose the clustering level from the drawer which will affect how clusters of glyphs are coloured.

Quick tip: If you set the environment variable `FONTTOOLS_LOOKUP_DEBUGGING=1` before running fontmake, Crowbar will also tell you the name and source location of all the lookups that get processed.

## Technical details and Developing

Crowbar is a [React](https://reactjs.org) JavaScript application. It uses [harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs) for shaping; Harfbuzz is the leading open source text shaping engine and is representative of how text will appear in a conforming OpenType implementation. It also uses [opentype.js](https://opentype.js.org) to extract information from the OpenType font format.

Contributions are welcome! To hack on Crowbar, you will need to:

* Clone this repository.
* Run `npm install`.
* Run `npm start` to start the server. Note that for paths to work you may need to adjust the `homepage` parameter in `package.json`.

## Selectable shaping engines

This fork lets you choose the shaping engine from the drawer:

| Engine | Runs | Notes |
|---|---|---|
| HarfBuzz | Browser (WebAssembly) | Default; the only engine with the lookup-by-lookup trace |
| HarfRust | Browser (WebAssembly) | The HarfBuzz team's Rust port of HarfBuzz |
| Allsorts | Browser (WebAssembly) | YesLogic's independent Rust shaper, used by Prince |
| fontkit | Browser (JavaScript) | Used by PDFKit and react-pdf |
| CoreText | GitHub Actions, macOS runner | Apple's shaper |
| DirectWrite | GitHub Actions, Windows runner | Microsoft's shaper |
| Uniscribe | GitHub Actions, Windows runner | Microsoft's legacy shaper |

Other engines don't expose their intermediate steps, so for them Crowbar shows the final glyph run with every glyph that differs from HarfBuzz highlighted.

### Native engines on GitHub Actions

The native engines run through [uharfbuzz](https://github.com/harfbuzz/uharfbuzz), whose macOS and Windows wheels include HarfBuzz's CoreText, DirectWrite and Uniscribe backends. Those backends hand shaping to the operating system. To use them:

1. Fork this repository and enable Actions on the fork.
2. Create a fine-grained personal access token for the fork with **Contents: read and write** and **Actions: read and write**.
3. In Crowbar, choose a native engine, open **GitHub settings**, enter the repository and token, and click **Generate** to create an encryption key. Add that key to the fork as the Actions secret `CROWBAR_KEY`.
4. Click **Shape on GitHub Actions**. Results usually arrive in about a minute and are cached in your browser.

The font and the text are encrypted in your browser before upload and are only decrypted on the runner. Results are encrypted the same way. Nothing readable is committed, even to a public repository; job files are deleted from the `crowbar-native-jobs` branch once results are fetched. The token and key are kept in your browser's local storage.

You can also run `native/shape.py` on your own Mac or Windows machine (`pip install -r native/requirements.txt`, then `python native/shape.py --font MyFont.otf --text "..." --script Deva --direction ltr --out results.json`) and load the JSON with **Load results file**. Results are matched by text and settings, so use the script, direction and features Crowbar resolves.

### Rebuilding the WebAssembly engines

The compiled HarfRust and Allsorts wrapper is committed in `src/engines/wasm`. To rebuild it (requires Rust and [wasm-pack](https://rustwasm.github.io/wasm-pack/)):

    cd shapers-wasm
    wasm-pack build --release --target web --out-dir ../src/engines/wasm --out-name shapers
    rm ../src/engines/wasm/.gitignore

## Roadmap

Upcoming features can be found in the Issues section. If you want to request a feature or report a bug, please add a new issue. Important upcoming features include:

* Support for variable fonts
* Display of lookups in AFDKO feature syntax

## License

This project is under an Apache license. See [LICENSE](LICENSE).
