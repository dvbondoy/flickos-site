// Donation wiring. Everything donate-related on the site reads from here (donor records live in src/data/donors.ts).
// To go live: replace every PLACEHOLDER value (drop methods you don't use), clear the example donors, then set enabled to true.
// Preview locally without flipping the flag: PUBLIC_DONATE_PREVIEW=true npm run dev

export interface DonateLink {
	id: string;
	label: string;
	blurb: string;
	url: string;
}

export interface CryptoWallet {
	id: string;
	label: string;
	symbol: string;
	// URI scheme encoded in the QR code, e.g. bitcoin:<address>.
	scheme: string;
	address: string;
}

const enabled = true;

export const donate = {
	enabled: enabled || import.meta.env.PUBLIC_DONATE_PREVIEW === 'true',
	href: '/donate/',

	// Monthly total banner ("So far in September 2026: ..."). Update by hand; set amount to 0 to hide it.
	// Counts every donation, including anonymous ones that aren't listed.
	thisMonth: {
		month: '2026-09', // YYYY-MM
		amount: 0,
		count: 0,
	},

	// One-time donations. These donors are listed on the donate page.
	primary: [
		{
			id: 'paypal',
			label: 'PayPal',
			blurb: 'Send any amount from your PayPal account.',
			url: 'https://paypal.me/dvbondoy',
		},
		{
			id: 'buymeacoffee',
			label: 'Buy Me a Coffee',
			blurb: 'Card, Apple Pay, or Google Pay. No account needed.',
			url: 'https://buymeacoffee.com/flickos',
		},
	] satisfies DonateLink[],

	// Recurring monthly support.
	recurring: [
		{
			id: 'patreon',
			label: 'Patreon',
			blurb: 'Support FlickOS every month.',
			url: 'https://www.patreon.com/flickos',
		},
	] satisfies DonateLink[],

	// Anonymous alternatives. These donations are not listed anywhere.
	// Hidden for now: an empty list hides the whole section. Uncomment and fill in real addresses to show it.
	crypto: [
		/*
		{ id: 'btc', label: 'Bitcoin', symbol: 'BTC', scheme: 'bitcoin', address: 'PLACEHOLDER_BTC_ADDRESS' },
		{ id: 'eth', label: 'Ethereum', symbol: 'ETH', scheme: 'ethereum', address: 'PLACEHOLDER_ETH_ADDRESS' },
		{ id: 'ltc', label: 'Litecoin', symbol: 'LTC', scheme: 'litecoin', address: 'PLACEHOLDER_LTC_ADDRESS' },
		{ id: 'bch', label: 'Bitcoin Cash', symbol: 'BCH', scheme: 'bitcoincash', address: 'PLACEHOLDER_BCH_ADDRESS' },
		{ id: 'xmr', label: 'Monero', symbol: 'XMR', scheme: 'monero', address: 'PLACEHOLDER_XMR_ADDRESS' },
		*/
	] satisfies CryptoWallet[],
};
