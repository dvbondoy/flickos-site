---
title: FlickOS Human Interface Guidelines
description: "These guidelines say how a FlickOS program should look, behave, read and be built. Every package in packages/ follows them: new packages from the start, and…"
sidebar:
  order: 0
---
These guidelines say how a FlickOS program should look, behave, read and be
built. Every package in `packages/` follows them: new packages from the start,
and existing ones as they are brought in line (see the [audit](/docs/hig/audit/)).

They are for anyone who adds or changes a FlickOS package, including AI
assistants working in this repository. They cover four layers, from what a user
sees down to the code:

| Page | What it covers |
|---|---|
| [01 – Principles](/docs/hig/01-principles/) | The four ideas every rule comes back to. Read this first |
| [02 – Fitting into the desktop](/docs/hig/02-desktop-integration/) | Menus, Settings, autostart, layouts and styles, first login, live and installed systems |
| [03 – Settings and files](/docs/hig/03-settings-and-files/) | One owner per setting, CLI first, where settings are stored, defaults, the overlay, system changes through pkexec |
| [04 – Windows and layout](/docs/hig/04-windows/) | Kinds of windows, size, spacing, rows and pages, buttons, dialogs, errors, empty and loading states |
| [05 – Writing](/docs/hig/05-writing/) | Voice, capitalization, ellipses, the words FlickOS uses, error messages, command-line output, translation-ready text |
| [06 – Visual style](/docs/hig/06-visual-style/) | Palette, CSS, the Dark and Light styles, icons, fonts, artwork |
| [07 – Accessibility](/docs/hig/07-accessibility/) | Keyboard-only use, contrast, screen readers, scaling |
| [08 – Performance](/docs/hig/08-performance/) | Opening fast, costing nothing while off, memory and disk budgets, measuring |
| [09 – Packaging](/docs/hig/09-packaging/) | Depends and Recommends, versions, copyright, conffiles, tests, boot-test checks |
| [10 – Code](/docs/hig/10-code/) | Python and shell conventions, GTK 3 patterns, known GTK/Wayland traps |
| [Checklist](/docs/hig/checklist/) | Every Must rule on one page, for reviewing a change |
| [Audit](/docs/hig/audit/) | Where the existing packages fall short today |

## How to read a rule

Every rule has an ID (like `WIN-3`), a level and a short title, then the reason
and examples.

- **Must**: always. The [checklist](/docs/hig/checklist/) and the [audit](/docs/hig/audit/)
  enforce these. Breaking one needs a change to this HIG first, not an
  exception in the code.
- **Should**: the normal case. Breaking one is fine when there is a reason, and
  the reason goes in a comment next to the code (or in the package's design
  doc), so the next person doesn't "fix" it.

**Do** and **Don't** examples come from real FlickOS code where there is one.

## Scope

- **FlickOS's own programs:** `flickos-control`, `flickos-layout`,
  `flickos-menu`, `flickos-shortcuts`, `flickos-welcome`, `flick-tiler`,
  helpers in `/usr/libexec/flickos/`, and any new ones.
- **FlickOS's configuration of other programs:** the panel (waybar, sfwbar),
  labwc menus and keys, mako, foot, fuzzel, the login screen, the installer
  branding. Here the rules about wording, palette and behavior apply. The
  rules about code don't.
- **Third-party code packaged by FlickOS** (`waypaper`, `sfwbar`): only the
  packaging rules ([09](/docs/hig/09-packaging/)) and FlickOS's own patches and
  defaults. Upstream's interface is left as it is.
- **Not covered:** Debian's apps (Firefox, LibreOffice, …). FlickOS only picks
  them ([01](/docs/hig/01-principles/#4-reuse-dont-rewrite)).

## Where the details live

This HIG says *what* to do and *why*. The step-by-step *how* stays where it
already is, and these pages link to it:

- [CLAUDE.md](https://github.com/dvbondoy/FlickOS/blob/main/CLAUDE.md): the short version of every package and the
  project's invariants.
- [04 – Packages](/docs/04-packages/) and [09 – Customizing](/docs/09-customizing/):
  how each package works and how to change it.
- [docs/design/](https://github.com/dvbondoy/FlickOS/tree/main/docs/design/): design docs with the decisions (ADRs) and
  measurements behind the bigger programs.

When a rule here and a detail there disagree, fix one of them in the same
change.

## Changing the HIG

The HIG is part of the repository and changes the same way as code: in a
commit, with the reason in the message. When a rule changes:

1. Update the rule and, for a Must, the [checklist](/docs/hig/checklist/).
2. Check the existing packages against it and update the [audit](/docs/hig/audit/).
3. If the rule came from a decision in a design doc, link the two.
