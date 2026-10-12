export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { ink: { 950: '#06080c', 900: '#0a0d13', 800: '#0f131b', 700: '#161b26', 600: '#222a39' }, acc: '#22d3ee', vio: '#8b5cf6', amb: '#f5b84b', ok: '#34d399', bad: '#f87171' },
    fontFamily: { sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
  } },
  plugins: [],
};
