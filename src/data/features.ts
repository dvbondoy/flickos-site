export interface Feature {
	title: string;
	body: string;
	href?: string;
	linkLabel?: string;
}

/** Shown on the home page under "Built for everyday use". */
export const highlights: Feature[] = [
	{
		title: 'Three live layouts',
		body: 'Redmond, Cupertino, and Traditional — switch from Settings without logging out.',
	},
	{
		title: 'Optional tiling',
		body: 'flick-tiler is off by default. Super+T toggles it; Super+M cycles arrangements.',
		href: '/screenshots/#tiling',
		linkLabel: 'See tiling screenshots',
	},
	{
		title: 'History: undo and redo',
		body: 'Settings → History lists every change to the desktop and installed software, newest first, each with Undo — and an undo can be undone too. Put Back as It Was… returns your settings to an earlier day.',
		href: '/#undo',
		linkLabel: 'How undo works',
	},
];

/** Everything else, on the Features page. */
export const features: Feature[] = [
	{
		title: 'One Settings window',
		body: 'All Settings covers layout, displays and night light, input, language and region, default and startup apps, notifications, power and idle, memory, date and time, updates, login, user accounts, firewall, tiling, shortcuts, and history. Type to search any setting.',
	},
	{
		title: 'Start menu',
		body: 'Tap Super or click the apps button: a classic menu in Redmond, categories in Traditional, a full-screen app grid in Cupertino. Prefer the plain app launcher? Switch back in Settings → Desktop Layout & Style.',
	},
	{
		title: 'Hold Super for shortcuts',
		body: 'Press and hold Super for about 0.7s to see the shortcut sheet; let go to close. Also under Settings → Keyboard Shortcuts.',
	},
	{
		title: 'Arc look everywhere',
		body: 'GTK, panel, terminal, launcher, notifications, boot menu, splash, and installer share the Arc palette. Light style available.',
	},
	{
		title: 'Firefox on less memory',
		body: 'Settings → Memory shows how much memory the computer has and uses. Turn on Firefox: use less memory to save about 130 MB with 9 tabs open on a 2 GB machine — recommended on computers with 3 GB or less.',
	},
	{
		title: 'Ready to use',
		body: 'Firefox ESR with uBlock Origin, LibreOffice, VLC, Software manager (PackageKit), PipeWire, NetworkManager, Flatpak, firewall on by default.',
	},
	{
		title: 'Updates that stick',
		body: 'FlickOS packages update via the apt repository alongside normal Debian security updates. Choose what installs automatically in Settings → Updates, or update by hand from Software Updates.',
	},
	{
		title: 'Install when ready',
		body: 'Boot the live session, explore, then install with Calamares from the desktop menu. At first login a welcome window points you to layouts, Settings, Wi-Fi, and shortcuts.',
	},
];
