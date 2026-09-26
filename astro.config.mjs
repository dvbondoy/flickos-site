// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import mermaid from 'astro-mermaid';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://flickos.net',
	output: 'static',
	integrations: [
		mermaid({
			theme: 'dark',
			autoTheme: true,
		}),
		starlight({
			title: 'FlickOS',
			description:
				'FlickOS 2.0 — a lightweight Debian 13 Wayland desktop with live ISO and Calamares installer.',
			favicon: '/favicon.svg',
			disable404Route: true,
			logo: {
				src: './src/assets/brand/flickos.svg',
				alt: 'FlickOS',
				replacesTitle: true,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/dvbondoy/FlickOS' },
			],
			customCss: ['./src/styles/global.css', './src/styles/theme.css'],
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: 'https://flickos.net/og-image.png' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:card', content: 'summary_large_image' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image', content: 'https://flickos.net/og-image.png' },
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@500;600;700&display=swap',
					},
				},
			],
			sidebar: [
				{
					label: 'Documentation',
					items: [
						{ label: 'Overview', slug: 'docs/01-overview' },
						{ label: 'Building and testing', slug: 'docs/02-building-and-testing' },
						{ label: 'live-build configuration', slug: 'docs/03-live-build-config' },
						{ label: 'Packages', slug: 'docs/04-packages' },
						{ label: 'Apt repository', slug: 'docs/05-apt-repository' },
						{ label: 'CI and releases', slug: 'docs/06-ci-and-releases' },
						{ label: 'Troubleshooting', slug: 'docs/07-troubleshooting' },
						{ label: 'Reference', slug: 'docs/08-reference' },
						{ label: 'Customizing', slug: 'docs/09-customizing' },
						{ label: 'Custom builds', slug: 'docs/10-custom-builds' },
					],
				},
				{
					label: 'Design guidelines (HIG)',
					items: [
						{ label: 'Introduction', slug: 'docs/hig' },
						{ label: 'Principles', slug: 'docs/hig/01-principles' },
						{ label: 'Fitting into the desktop', slug: 'docs/hig/02-desktop-integration' },
						{ label: 'Settings and files', slug: 'docs/hig/03-settings-and-files' },
						{ label: 'Windows and layout', slug: 'docs/hig/04-windows' },
						{ label: 'Writing', slug: 'docs/hig/05-writing' },
						{ label: 'Visual style', slug: 'docs/hig/06-visual-style' },
						{ label: 'Accessibility', slug: 'docs/hig/07-accessibility' },
						{ label: 'Performance', slug: 'docs/hig/08-performance' },
						{ label: 'Packaging', slug: 'docs/hig/09-packaging' },
						{ label: 'Code', slug: 'docs/hig/10-code' },
						{ label: 'Review checklist', slug: 'docs/hig/checklist' },
						{ label: 'Audit', slug: 'docs/hig/audit' },
					],
				},
			],
			components: {
				SiteTitle: './src/components/starlight/SiteTitle.astro',
				ThemeProvider: './src/components/starlight/ThemeProvider.astro',
				ThemeSelect: './src/components/starlight/ThemeSelect.astro',
			},
		}),
		sitemap(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
