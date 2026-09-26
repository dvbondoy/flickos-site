// Donor records shown on /donate/. Add one entry per donation, newest anywhere (the page sorts by date).
// name: as it should appear publicly, e.g. "Donna B." Use "Anonymous" if the donor asked not to be named.
// country: ISO 3166-1 alpha-2 code (US, DE, PH, ...). amount: in USD.
// website: optional; linked from the top donors table.
// Repeat donors are matched by exact name, so keep it spelled the same each time.

export interface Donation {
	date: string; // YYYY-MM-DD
	name: string;
	country: string;
	amount: number;
	website?: string;
}

export const donations: Donation[] = [];
