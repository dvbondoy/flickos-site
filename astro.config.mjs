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
					],
				},
			],
			components: {
				SiteTitle: './src/components/starlight/SiteTitle.astro',
			},
		}),
		sitemap(),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
