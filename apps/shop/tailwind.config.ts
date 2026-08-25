import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#010102",
        "surface-1": "#0f1011",
        "surface-2": "#141516",
        "surface-3": "#18191a",
        "surface-4": "#191a1b",
        hairline: "#23252a",
        "hairline-strong": "#34343a",
        "hairline-tertiary": "#3e3e44",
        "linear-primary": "#5e6ad2",
        "linear-primary-hover": "#828fff",
        "linear-primary-focus": "#5e69d1",
        ink: "#f7f8f8",
        "ink-muted": "#d0d6e0",
        "ink-subtle": "#8a8f98",
        "ink-tertiary": "#62666d",
        "brand-secure": "#7a7fad",
        "semantic-success": "#27a644",
        "footergray": "hsl(0, 0%, 60%)",
        "silver":"hsl(0, 0%, 47%)",
        "footerblack":"hsl(0, 0%, 13%)",
        "salmon":"#0D94FB",
        "sandyBrown": "hsl(29, 90%, 65%)",
        "bittersweet": "#0D94FB",
        "brand-navy": "#012652",
        "brand-azure": "#0D94FB",
        "navy": "#012652",
        "azure": "#0D94FB",
        "oceanGreen": "hsl(152, 51%, 52%)",
        "davysilver":"hsl(0, 0%, 33%)",
        "cultured": "hsl(0, 0%, 93%)",
        "white": "hsl(0, 100%, 100%)",
        "onyx": "hsl(0, 0%, 27%)",
        "eblack":"hsl(0, 0%, 13%)",
        "blueIn":"#012652",
        "blueAc":"#0D94FB",
        "btnpurple":"#012652",
        primary: {"50":"#eff6ff","100":"#dbeafe","200":"#bfdbfe","300":"#93c5fd","400":"#60a5fa","500":"#0D94FB","600":"#0b80d8","700":"#012652","800":"#011d3f","900":"#01142c","950":"#000c1c"},
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'xxl': '24px',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      dropShadow: {
        'custom-xl': '0 0 5px rgba(0, 0, 0, 0.25)',
      },
      fontFamily: {
        'display': [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Inter',
          'sans-serif'
        ],
        'body': [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Inter',
          'sans-serif'
        ],
        'sans': [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Inter',
          'sans-serif'
        ],
        'mono': [
          'ui-monospace',
          'SF Mono',
          'Menlo',
          'JetBrains Mono',
          'monospace'
        ]
      }
    },
  },
  darkMode: "class",
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
  
};
export default config;
