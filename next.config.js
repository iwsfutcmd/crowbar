module.exports = {
  output: "export",
  distDir: "build",
  basePath: "/crowbar",
  // harfbuzzjs' Emscripten glue has a Node-only branch that dynamically imports
  // Node's builtin `module` (for `createRequire`). It is never taken in the
  // browser, but bundlers still try to resolve it statically. Alias it to an
  // empty module for browser builds so the bundler has something to resolve.
  turbopack: {
    resolveAlias: {
      module: { browser: "./src/empty-module.js" },
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      module: false,
    };
    return config;
  },
};
