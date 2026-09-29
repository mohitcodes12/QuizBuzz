/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stage: '#1E1B78', // page background: deep cobalt, like a game-show set
        raised: '#28249A', // panels sitting on the stage
        sunk: '#16135A', // inputs / recessed areas
        line: 'rgb(255 255 255 / 0.16)',
        paper: '#F4F2FF', // main text
        muted: '#B9B5F0', // secondary text
        buzzer: '#FFD23F', // the one loud accent: the buzzer button
        'buzzer-deep': '#B98F00',
        ink: '#16135A', // text on bright colours
        coral: '#FF8F87',
        sky: '#72CBFF',
        mint: '#7DE3A8',
        lilac: '#C9AEFF',
        danger: '#FF7A7A',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
