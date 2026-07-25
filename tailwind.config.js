/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Nb international pro webfont',
  				'Google Sans',
  				'Arial',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			// Type scale — pair size with line-height so headings stop being ad-hoc
  			caption: ['0.75rem', { lineHeight: '1rem' }],
  			label: ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '500' }],
  			body: ['0.875rem', { lineHeight: '1.375rem' }],
  			'body-lg': ['1rem', { lineHeight: '1.5rem' }],
  			h3: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
  			h2: ['1.5rem', { lineHeight: '1.875rem', fontWeight: '600' }],
  			h1: ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
  			display: ['2.5rem', { lineHeight: '2.75rem', fontWeight: '700' }]
  		},
  		colors: {
  			brand: {
  				plum: '#4A2545',
  				navy: '#0F172A',
  				// berry is an alias of --primary; prefer the `primary` token
  				berry: 'hsl(var(--primary))'
  			},
  			severity: {
  				// All severity levels are shades of the brand pink — intensity
  				// encodes urgency (crisis = deepest, routine = lightest). Only
  				// `inactive` is neutral grey. Wired to the --primary-* ramp.
  				'crisis-bg': 'hsl(var(--primary-200))',
  				'crisis-fg': 'hsl(var(--primary-900))',
  				'elevated-bg': 'hsl(var(--primary-100))',
  				'elevated-fg': 'hsl(var(--primary-800))',
  				'monitor-bg': 'hsl(var(--primary-100))',
  				'monitor-fg': 'hsl(var(--primary-600))',
  				'routine-bg': 'hsl(var(--primary-50))',
  				'routine-fg': 'hsl(var(--primary-500))',
  				'inactive-bg': '#F3F4F6',
  				'inactive-fg': '#9CA3AF'
  			},
  			surface: {
  				app: 'hsl(var(--surface-app))',
  				'tint-1': 'hsl(var(--primary-100))',
  				'tint-2': 'hsl(var(--surface-tint-2))',
  				'tint-3': 'hsl(var(--surface-tint-3))',
  				'tint-4': 'hsl(var(--surface-tint-4))',
  				'stat-number': 'hsl(var(--primary-900))',
  				'stat-label': 'hsl(var(--surface-stat-label))'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				'50': 'hsl(var(--primary-50))',
  				'100': 'hsl(var(--primary-100))',
  				'200': 'hsl(var(--primary-200))',
  				'300': 'hsl(var(--primary-300))',
  				'400': 'hsl(var(--primary-400))',
  				'500': 'hsl(var(--primary-500))',
  				'600': 'hsl(var(--primary-600))',
  				'700': 'hsl(var(--primary-700))',
  				'800': 'hsl(var(--primary-800))',
  				'900': 'hsl(var(--primary-900))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: 'hsl(var(--destructive))',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
