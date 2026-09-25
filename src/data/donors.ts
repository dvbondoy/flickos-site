// Donor records shown on /donate/. Add one entry per donation, newest anywhere (the page sorts by date).
// name: as it should appear publicly, e.g. "Donna B." Use "Anonymous" if the donor asked not to be named.
// country: ISO 3166-1 alpha-2 code (US, DE, PH, ...). amount: in USD.
// website: optional; linked from the top donors table.
// Repeat donors are matched by exact name, so keep it spelled the same each time.
//
// The entries below are FAKE EXAMPLES for previewing the layout. Delete them all before going live.

export interface Donation {
	date: string; // YYYY-MM-DD
	name: string;
	country: string;
	amount: number;
	website?: string;
}

export const donations: Donation[] = [
	{ date: '2026-09-23', name: 'Marco R.', country: 'IT', amount: 5 },
	{ date: '2026-09-22', name: 'Sarah K.', country: 'US', amount: 10, website: 'https://example.com' },
	{ date: '2026-09-21', name: 'Anonymous', country: 'DE', amount: 3 },
	{ date: '2026-09-19', name: 'Paolo M.', country: 'PH', amount: 2 },
	{ date: '2026-09-17', name: 'Lukas W.', country: 'DE', amount: 5 },
	{ date: '2026-09-14', name: 'James T.', country: 'GB', amount: 10, website: 'https://example.org' },
	{ date: '2026-09-11', name: 'Amélie D.', country: 'FR', amount: 4 },
	{ date: '2026-09-08', name: 'Kenji S.', country: 'JP', amount: 8 },
	{ date: '2026-09-05', name: 'Sarah K.', country: 'US', amount: 10, website: 'https://example.com' },
	{ date: '2026-09-02', name: 'Rafael C.', country: 'BR', amount: 2 },
	{ date: '2026-08-28', name: 'Emma J.', country: 'SE', amount: 6 },
	{ date: '2026-08-24', name: 'Daniel O.', country: 'CA', amount: 7, website: 'https://example.net' },
	{ date: '2026-08-19', name: 'Lukas W.', country: 'DE', amount: 5 },
	{ date: '2026-08-15', name: 'Priya N.', country: 'IN', amount: 3 },
	{ date: '2026-08-10', name: 'James T.', country: 'GB', amount: 10, website: 'https://example.org' },
	{ date: '2026-08-05', name: 'Sarah K.', country: 'US', amount: 10, website: 'https://example.com' },
	{ date: '2026-07-30', name: 'Tomasz Z.', country: 'PL', amount: 5 },
	{ date: '2026-07-22', name: 'Ana L.', country: 'ES', amount: 2 },
	{ date: '2026-07-14', name: 'Michael B.', country: 'AU', amount: 10 },
];
