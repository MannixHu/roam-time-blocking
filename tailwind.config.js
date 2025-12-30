/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  // Use a prefix to avoid conflicts with Roam's styles
  prefix: "tb-",
  theme: {
    extend: {
      colors: {
        border: "var(--border-color, #e0e0e0)",
        "border-light": "var(--border-light, #f0f0f0)",
        background: "var(--background-color, #fff)",
        "text-primary": "var(--text-color, #333)",
        "text-secondary": "var(--text-secondary, #666)",
        hover: "var(--hover-bg, #f0f0f0)",
      },
    },
  },
  plugins: [],
  // Important for embedding in Roam
  corePlugins: {
    preflight: false, // Don't reset Roam's styles
  },
};
