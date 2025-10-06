/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    // include pages if you add them
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'SF Pro Text'", 'ui-sans-serif', 'system-ui', '-apple-system', "'Segoe UI'", 'Roboto', "'Helvetica Neue'", 'Arial', "'Noto Sans'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};
