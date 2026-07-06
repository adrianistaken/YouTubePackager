/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#f1f1f1',
        paper: '#0f0f0f',
        panel: '#161616',
        line: '#2a2a2a',
        graphite: '#aaaaaa',
        signal: '#ff0033',
        marker: '#3ea6ff',
        wash: '#212121',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        lift: '0 18px 60px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
}
