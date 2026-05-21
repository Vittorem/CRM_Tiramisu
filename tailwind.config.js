/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  corePlugins: {
    preflight: false, // Prevents Tailwind from resetting Ant Design's default global styles
  },
  plugins: [],
}
