#!/usr/bin/env node
/**
 * Vendor flickos/docs into src/content/docs/docs/ for Starlight.
 *
 * - Injects YAML frontmatter (title, description, sidebar.order)
 * - Strips the leading `# NN – Title` heading (becomes the page title)
 * - Resolves relative links from each doc's own folder
 * - Rewrites cross-doc links: 04-packages.md → /docs/04-packages/
 * - Rewrites hig/*.md → /docs/hig/.../
 * - Rewrites links to other repo files to GitHub URLs
 * - design/ is internal and not published; links to it go to GitHub
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC =
	process.env.FLICKOS_DOCS_PATH ??
	path.resolve(ROOT, '../flickos/docs');
const DEST = path.join(ROOT, 'src/content/docs/docs');
const HIG_DEST = path.join(DEST, 'hig');
const GITHUB = 'https://github.com/dvbondoy/FlickOS';

/** Links already written from the repo root (e.g. `packages/foo`), not relative to the doc. */
const REPO_ROOT_LINK = /^(?:auto|config|docs|packages|repo|tools)\//;

/** Repo path of a published doc → its site URL. */
const SITE_PAGES = [
	[/^docs\/(\d{2}-[a-z0-9-]+)\.md$/i, (m) => `/docs/${m[1]}/`],
	[/^docs\/hig\/README\.md$/i, () => '/docs/hig/'],
	[/^docs\/hig\/([a-z0-9-]+)\.md$/i, (m) => `/docs/hig/${m[1].toLowerCase()}/`],
];

function titleFromHeading(heading, { numbered = true } = {}) {
	if (numbered) {
		// "# 01 – Overview" or "# 09 – Customizing FlickOS"
		const m = heading.match(/^#\s+\d{2}\s+[–—-]\s+(.+)\s*$/);
		if (m) {
			let title = m[1].trim();
			title = title.replace(/^Customizing FlickOS$/, 'Customizing');
			return title;
		}
	}
	return heading.replace(/^#\s+/, '').trim();
}

/** For docs that open with a heading instead of an intro paragraph. */
const FALLBACK_DESCRIPTIONS = {
	'01-overview.md':
		'What FlickOS is, how the repository is laid out, and where to change each part of the desktop.',
	'02-building-and-testing.md':
		'Build the FlickOS ISO on Debian 13, boot-test it, and try the live session and installer in QEMU.',
	'06-ci-and-releases.md':
		'Where FlickOS ISOs and packages are published, what CI builds, and how a release is cut.',
	'08-reference.md': 'Command cheat sheet, file locations, and quick reference for FlickOS maintainers.',
};

/** Markdown inline syntax → plain text, for meta descriptions. */
function plainText(md) {
	// Set code spans aside so emphasis stripping keeps e.g. the * in `flickos-*`.
	const code = [];
	return md
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]*)`/g, (_, text) => `\0${code.push(text) - 1}\0`)
		.replace(/\*\*/g, '')
		.replace(/\*(\S(?:[^*]*\S)?)\*/g, '$1')
		.replace(/\0(\d+)\0/g, (_, i) => code[i])
		.replace(/\s+/g, ' ')
		.trim();
}

function descriptionFromBody(body, filename) {
	// Paragraphs before the first heading, code block or table.
	const paras = [];
	let buf = [];
	for (const line of body.split('\n')) {
		if (line.startsWith('#') || line.startsWith('```') || line.startsWith('|')) break;
		if (line.startsWith('- [')) continue; // TOC
		if (line.trim() === '') {
			if (buf.length) paras.push(buf.join(' '));
			buf = [];
			continue;
		}
		buf.push(line.trim());
	}
	if (buf.length) paras.push(buf.join(' '));
	// Some docs open with a status line; the next paragraph says what they are.
	const intro = paras.find((p) => !p.startsWith('**Status:**'));
	let desc = intro ? plainText(intro) : FALLBACK_DESCRIPTIONS[filename] ?? 'FlickOS documentation.';
	if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, '') + '…';
	return desc;
}

/**
 * `fromDir` is the linking doc's folder in the product repo (`docs`, `docs/hig`).
 * Other docs become site URLs; any other repo file becomes a GitHub URL.
 */
function rewriteHref(href, fromDir) {
	if (!href || /^[a-z]+:/i.test(href) || href.startsWith('#')) return href;

	const hashAt = href.indexOf('#');
	const bare = hashAt === -1 ? href : href.slice(0, hashAt);
	const hash = hashAt === -1 ? '' : href.slice(hashAt);

	const repoPath = REPO_ROOT_LINK.test(bare)
		? path.posix.normalize(bare)
		: path.posix.normalize(path.posix.join(fromDir, bare));
	if (repoPath.startsWith('../')) return href;

	for (const [pattern, url] of SITE_PAGES) {
		const m = repoPath.match(pattern);
		if (m) return url(m) + hash;
	}
	const kind = repoPath.endsWith('/') ? 'tree' : 'blob';
	return `${GITHUB}/${kind}/main/${repoPath}${hash}`;
}

function rewriteLinks(markdown, fromDir) {
	return markdown.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, text, href) => {
		const next = rewriteHref(href.trim(), fromDir);
		return `[${text}](${next})`;
	});
}

function yamlEscape(s) {
	if (/[:#{}[\],&*?|>!%@`]/.test(s) || s.includes("'") || s.includes('"')) {
		return JSON.stringify(s);
	}
	return s;
}

function splitHeading(raw, filename) {
	const lines = raw.split('\n');
	let i = 0;
	while (i < lines.length && lines[i].trim() === '') i++;
	const heading = lines[i] || '';
	if (!heading.startsWith('#')) {
		throw new Error(`${filename}: expected leading H1, got: ${heading.slice(0, 40)}`);
	}
	i++;
	while (i < lines.length && lines[i].trim() === '') i++;
	const body = lines.slice(i).join('\n').replace(/\s+$/, '') + '\n';
	return { heading, body };
}

/** `relPath` is relative to SRC, e.g. `04-packages.md` or `hig/01-principles.md`. */
function processFile(relPath, order) {
	const filename = path.basename(relPath);
	const raw = fs.readFileSync(path.join(SRC, relPath), 'utf8');
	const { heading, body } = splitHeading(raw, relPath);
	const title = titleFromHeading(heading, { numbered: /^\d{2}-/.test(filename) });
	const description = descriptionFromBody(body, filename);
	const rewritten = rewriteLinks(body, path.posix.join('docs', path.posix.dirname(relPath)));

	const frontmatter = [
		'---',
		`title: ${yamlEscape(title)}`,
		`description: ${yamlEscape(description)}`,
		'sidebar:',
		`  order: ${order}`,
		'---',
		'',
	].join('\n');

	return frontmatter + rewritten;
}

function clearMarkdown(dir) {
	if (!fs.existsSync(dir)) return;
	for (const existing of fs.readdirSync(dir)) {
		const full = path.join(dir, existing);
		const st = fs.statSync(full);
		if (st.isDirectory()) continue;
		if (existing.endsWith('.md') || existing.endsWith('.mdx')) {
			fs.unlinkSync(full);
		}
	}
}

function main() {
	if (!fs.existsSync(SRC)) {
		console.error(`Docs source not found: ${SRC}`);
		console.error('Set FLICKOS_DOCS_PATH or clone flickos next to this repo.');
		process.exit(1);
	}

	for (const dir of [DEST, HIG_DEST]) {
		fs.mkdirSync(dir, { recursive: true });
		clearMarkdown(dir);
	}

	const files = fs
		.readdirSync(SRC)
		.filter((f) => /^\d{2}-.+\.md$/.test(f))
		.sort();

	if (!files.length) {
		console.error(`No doc files in ${SRC}`);
		process.exit(1);
	}

	let linkCount = 0;
	for (const file of files) {
		const out = processFile(file, Number(file.slice(0, 2)));
		linkCount += (out.match(/\]\(\/docs\//g) || []).length;
		fs.writeFileSync(path.join(DEST, file), out);
		console.log(`wrote docs/${file}`);
	}

	// HIG: README is the section's landing page, numbered pages next, then checklist and audit.
	const higDir = path.join(SRC, 'hig');
	const higFiles = fs.existsSync(higDir)
		? fs
				.readdirSync(higDir)
				.filter((f) => /^[a-z0-9-]+\.md$/i.test(f))
				.sort()
		: [];
	const HIG_TAIL = ['checklist.md', 'audit.md'];
	const higRank = (f) =>
		f === 'README.md' ? 0 : /^\d{2}-/.test(f) ? Number(f.slice(0, 2)) : 100 + HIG_TAIL.indexOf(f);
	higFiles
		.sort((a, b) => higRank(a) - higRank(b) || a.localeCompare(b))
		.forEach((file, idx) => {
			const out = processFile(`hig/${file}`, idx);
			const destName = file === 'README.md' ? 'index.md' : file.toLowerCase();
			linkCount += (out.match(/\]\(\/docs\//g) || []).length;
			fs.writeFileSync(path.join(HIG_DEST, destName), out);
			console.log(`wrote docs/hig/${destName}`);
		});

	// Small docs landing page
	const index = `---
title: Documentation
description: FlickOS build, package, and customization guides.
sidebar:
  order: 0
  hidden: true
---

Welcome to the FlickOS documentation. Start with [Overview](/docs/01-overview/) if you are new to the repository.

Adding or changing a FlickOS program? Follow the [Human Interface Guidelines](/docs/hig/).
`;
	fs.writeFileSync(path.join(DEST, 'index.mdx'), index);
	console.log(
		`synced ${files.length} docs + ${higFiles.length} hig → ${path.relative(ROOT, DEST)} (${linkCount} /docs/ links)`,
	);
}

main();
