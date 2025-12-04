import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "**/*.md",
      "**/*.mdx",
    ],
  },
  {
    rules: {
      // Disable overly strict React 19 hooks rules - these patterns are valid
      // (e.g., loading from localStorage on mount, fetching data on mount)
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;
