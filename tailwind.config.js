/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        aerovex: {
          canvas: "var(--bg-canvas)",
          "canvas-subtle": "var(--bg-canvas-subtle)",
          surface: "var(--bg-surface)",
          card: "var(--bg-card)",
          "card-hover": "var(--bg-card-hover)",
          "card-active": "var(--bg-card-active)",
          hud: "var(--bg-hud)",
          border: "var(--border-subtle)",
          "border-hairline": "var(--border-hairline)",
          accent: "var(--text-accent)",
          "accent-hover": "var(--text-accent-hover)",
          text: "var(--text-primary)",
          "text-secondary": "var(--text-secondary)",
          "text-muted": "var(--text-muted)"
        }
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)"
      }
    }
  },
  plugins: []
};
