export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        graphite: "#0B1117",
        ink: "#061827",
        neon: "#45FF95",
        lagoon: "#0EA5B7",
        warning: "#FFC857"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(69, 255, 149, .35), 0 18px 44px rgba(69, 255, 149, .12)"
      }
    }
  },
  plugins: []
};
