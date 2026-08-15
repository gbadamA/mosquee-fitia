// Mêmes tokens que le dashboard — via le preset partagé.
const preset = require("@fitia/design-tokens/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset"), preset],
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/**/src/**/*.{ts,tsx}",
  ],
};
