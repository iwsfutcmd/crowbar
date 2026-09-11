// Empty placeholder module.
//
// `harfbuzzjs` is built with Emscripten and contains a Node-only code path that
// dynamically imports Node's builtin `module` (to call `createRequire`). That
// path is never executed in the browser, but bundlers still try to resolve the
// import statically. `next.config.js` aliases `module` to this file for browser
// builds so the bundler has something harmless to resolve.
export default {};
