module.exports = {
  env: {
    browser: true,
    es2024: true,
    node: true,
    webextensions: true,
  },
  globals: {
    browser: "readonly",
    messenger: "readonly",
    ChromeUtils: "readonly",
    Components: "readonly",
    PathUtils: "readonly",
    Services: "readonly",
    FiltaQuilla: "readonly",
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // your rules here
    "no-const-assign": "error",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-undef": "error",
    "no-redeclare": "error",
    eqeqeq: "off",
    curly: "warn",
  },
};
