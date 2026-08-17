/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  // 跟随系统深浅色自动切换
  darkMode: "media",
  content: ["./**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace"
        ]
      }
    }
  },
  plugins: []
}
