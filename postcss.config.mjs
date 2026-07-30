// Tailwind CSS v4 wird über das PostCSS-Plugin eingebunden. Keine tailwind.config nötig —
// v4 erkennt die genutzten Klassen automatisch aus den Projektdateien.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
