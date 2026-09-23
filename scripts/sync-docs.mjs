#!/usr/bin/env node
/**
 * Vendor flickos/docs into src/content/docs/docs/ for Starlight.
 *
 * - Injects YAML frontmatter (title, description, sidebar.order)
 * - Strips the leading `# NN – Title` heading (becomes the page title)
 * - Rewrites cross-doc links: 04-packages.md → /docs/04-packages/
 * - Rewrites design/*.md → /docs/design/.../
 * - Rewrites docs/-prefixed links the same way
 * - Rewrites repo-relative paths to GitHub blob URLs
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
const DESIGN_DEST = path.join(DEST, 'design');
const GITHUB_BLOB = 'https://github.com/dvbondoy/FlickOS/blob/main';

const DOC_FILE = /^(?:docs\/)?(\d{2}-[a-z0-9-]+)\.md(#.*)?$/i;
const DESIGN_FILE = /^(?:docs\/)?design\/([a-z0-9-]+)\.md(#.*)?$/i;

/** Paths that live in the product repo, not on the site. */
const REPO_PATH =
	/^(?:\.\.\/)*(?:LICENSE|README\.md|RELEASE_NOTES\.md|auto\/|config\/|packages\/|tools\/|repo\/|docs\/(?!\d|design\/))/;

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

function descriptionFromBody(body) {
	const lines = body.split('\n');
	const paras = [];
	let buf = [];
	for (const line of lines) {
		if (line.startsWith('#')) break;
		if (line.startsWith('```')) break;
		if (line.startsWith('|')) break;
		if (line.startsWith('- [')) continue; // TOC
		if (line.trim() === '') {
			if (buf.length) {
				paras.push(buf.join(' ').trim());
				buf = [];
			}
			continue;
		}
		buf.push(line.trim());
		if (paras.length + (buf.length ? 1 : 0) >= 1 && buf.join(' ').length > 40) {
			paras.push(buf.join(' ').trim());
			break;
		}
	}
	if (!paras.length && buf.length) paras.push(buf.join(' ').trim());
	let desc = (paras[0] || 'FlickOS documentation.').replace(/\s+/g, ' ').trim();
	if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, '') + '…';
	return desc;
}

function rewriteHref(href) {
	if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
		return href;
	}
	if (href.startsWith('#')) return href;

	const designMatch = href.match(DESIGN_FILE);
	if (designMatch) {
		const slug = designMatch[1];
		const hash = designMatch[2] || '';
		return `/docs/design/${slug}/${hash}`;
	}

	const docMatch = href.match(DOC_FILE);
	if (docMatch) {
		const slug = docMatch[1];
		const hash = docMatch[2] || '';
		return `/docs/${slug}/${hash}`;
	}

	const bare = href.split('#')[0];
	const hash = href.includes('#') ? '#' + href.split('#').slice(1).join('#') : '';
	if (REPO_PATH.test(bare) || bare === 'LICENSE' || bare === 'README.md') {
		const cleaned = bare.replace(/^\.\.\//, '');
		return `${GITHUB_BLOB}/${cleaned}${hash}`;
	}

	return href;
}

function rewriteLinks(markdown) {
	return markdown.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (full, text, href) => {
		const next = rewriteHref(href.trim());
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

function processNumberedFile(filename) {
	const order = Number(filename.slice(0, 2));
	const raw = fs.readFileSync(path.join(SRC, filename), 'utf8');
	const { heading, body } = splitHeading(raw, filename);
	const title = titleFromHeading(heading, { numbered: true });
	const description = descriptionFromBody(body);
	const rewritten = rewriteLinks(body);

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

function processDesignFile(filename, order) {
	const raw = fs.readFileSync(path.join(SRC, 'design', filename), 'utf8');
	const { heading, body } = splitHeading(raw, `design/${filename}`);
	const title = titleFromHeading(heading, { numbered: false });
	const description = descriptionFromBody(body);
	const rewritten = rewriteLinks(body);

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

	fs.mkdirSync(DEST, { recursive: true });
	fs.mkdirSync(DESIGN_DEST, { recursive: true });
	clearMarkdown(DEST);
	clearMarkdown(DESIGN_DEST);

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
		const out = processNumberedFile(file);
		linkCount += (out.match(/\]\(\/docs\//g) || []).length;
		fs.writeFileSync(path.join(DEST, file), out);
		console.log(`wrote docs/${file}`);
	}

	const designDir = path.join(SRC, 'design');
	const designFiles = fs.existsSync(designDir)
		? fs
				.readdirSync(designDir)
				.filter((f) => /^[a-z0-9-]+\.md$/i.test(f))
				.sort()
		: [];

	designFiles.forEach((file, idx) => {
		const out = processDesignFile(file, idx + 1);
		linkCount += (out.match(/\]\(\/docs\//g) || []).length;
		fs.writeFileSync(path.join(DESIGN_DEST, file), out);
		console.log(`wrote docs/design/${file}`);
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
`;
	fs.writeFileSync(path.join(DEST, 'index.mdx'), index);
	console.log(
		`synced ${files.length} docs + ${designFiles.length} design → ${path.relative(ROOT, DEST)} (${linkCount} /docs/ links)`,
	);
}

main();
