---
title: FlickOS Control Center (flickos-control)
description: "**Status:** Accepted, 2026-09-22. All phases (0 spikes, 1 the hub, 2 input,"
sidebar:
  order: 1
---
**Status:** Accepted, 2026-09-22. All phases (0 spikes, 1 the hub, 2 input,
3 system and session, 4 About) are done, in flickos-control 1.0. What is
left is listed under each phase and in section 5. When a phase is
done, its package goes into `docs/04-packages.md` and this file records only
the decisions.

This document proposes one Settings window for FlickOS, split into phases, and
records the design decisions as ADRs (architecture decision records).

- [1. Problem](#1-problem)
- [2. Goals and non-goals](#2-goals-and-non-goals)
- [3. Decisions (ADRs)](#3-decisions-adrs)
- [4. Phases](#4-phases)
- [5. Risks and open questions](#5-risks-and-open-questions)

## 1. Problem

The *Settings* submenu (`packages/flickos-settings/etc/xdg/labwc/menu.xml`)
opens 10 separate apps: `flickos-layout pick`, waypaper, nwg-look, wdisplays,
nm-connection-editor, pavucontrol, blueman-manager, system-config-printer,
gpk-update-viewer and `flickos-shortcuts show`. Each one looks and behaves
differently, and users have no single place to start.

Some common settings have no GUI at all:

| Setting | Today |
|---|---|
| Touchpad and mouse (natural scrolling, pointer speed, left-handed, click method) | Not set. flickos-settings' `rc.xml` has no `<libinput>` section, so labwc's defaults apply (tap to click is on: labwc enables it by default, unlike libinput). |
| Keyboard layout | Read from `/etc/default/keyboard` by `flickos-session` (and the greeter) at login. It is set by the installer and can only be changed from a terminal afterwards. |
| Key repeat, Num Lock | labwc defaults. |
| Idle lock and suspend | Hardcoded in `usr/libexec/flickos/autostart` (swayidle: lock after 300 s, suspend after 900 s). |
| Tiling gap, windows that always float | Only by editing `~/.config/flickos/tiler` (flick-tiler had no CLI for them). |
| Autologin | Membership in the `autologin` group (flickos-greeter). Only with `gpasswd` as root. |
| Default applications | Only with `xdg-mime` in a terminal. |

Any solution has to keep the rules in `CLAUDE.md`:

- It ships as a `.deb`, so it works for both the ISO and the apt repo.
- It writes nothing to `$HOME` except `~/.config/flickos/*`.
- It changes labwc only through the runtime overlay in `$XDG_RUNTIME_DIR/flickos/`, and never touches `~/.config/labwc/rc.xml`.
- It adds no colors outside the Arc palette.
- The installed and live menus stay the same apart from the installer entry.
- Every change gets a changelog bump.
- New must-haves are Depends, not Recommends.

## 2. Goals and non-goals

Goals:

- One window, titled **Settings**, that reaches every setting FlickOS offers.
- Native pages for FlickOS's own features and for the gaps listed above.
- Every setting can also be changed from the command line, with the same result.

Non-goals:

- Rewriting network, sound, Bluetooth, printer, display or update settings.
  The existing apps work, and replacing them would mean maintaining a lot of
  code. They get launch tiles.
- Embedding other apps' windows in the Settings window. Wayland has no
  equivalent of XEmbed/GtkSocket, so launched apps open in their own window.

## 3. Decisions (ADRs)

### ADR-001: A hub, not a rewrite

**Context.** Plasma System Settings is built from KCMs, one module per topic,
each backed by a lot of code. FlickOS is maintained by very few people and uses
upstream tools wherever it can.

**Decision.** Follow the Xfce Settings Manager model. A native page only where
FlickOS owns the setting, or where no usable tool exists. Everything else is a
tile that launches the existing app.

**Consequences.** Less polish than Plasma: some tiles open windows with a
different layout. The code stays small enough to maintain.

**Alternatives rejected.** Plasma-style modules for everything: too much code
to maintain. Keeping only the menu: it doesn't fix the gaps in section 1.

### ADR-002: A new package `flickos-control`

**Context.** The code needs a home. `flickos-settings` holds configuration only.
`flickos-layouts` is already 2,144 lines and is about layouts and styles.

**Decision.** A new native package `flickos-control` (`Architecture: all`) with
the command `/usr/bin/flickos-control`. It becomes a Depends of `flickos-desktop`
and goes into `REQUIRED` in `config/hooks/normal/0010-sanity.hook.chroot`. The
window title and menu label are "Settings". The package name avoids a clash
with the existing `flickos-settings`.

**Consequences.** One more package to version and publish. Existing installs
get it through flickos-desktop's Depends.

**Alternatives rejected.** Putting it into flickos-layouts (mixes concerns and
makes it bigger still) or into flickos-settings (that package has no program
logic).

### ADR-003: Python 3 + GTK 3, `GtkStack` with `GtkStackSidebar`

**Context.** The palette invariant requires Arc-Dark/Arc everywhere. FlickOS's
own tools with a GUI (the `flickos-layout pick` chooser, the `flickos-shortcuts`
sheet) are single Python 3 files that use GTK 3 through python3-gi.

**Decision.** A single Python 3 file, standard library plus python3-gi and GTK 3.
The window has a sidebar of pages (`GtkStackSidebar`) and a content area
(`GtkStack`). There is no own CSS: colors come from the GTK theme.

**Consequences.** It follows the Dark and Light styles automatically. It is
packaged exactly like `flickos-shortcuts` (tests run at build, with
`PYTHONDONTWRITEBYTECODE`).

**Alternatives rejected.** GTK 4 with libadwaita: it ignores GTK themes, so it
would break the palette. Qt: a second toolkit for one app.

### ADR-004: CLI first; each setting has one owner

**Context.** GUI code can't be tested in the package build, and FlickOS tools
already have CLIs: `flickos-layout list|current|set|style …|clicks …`,
`flick-tiler status|modes|mode|ratio|toggle`, `flickos-shortcuts show|list`.

**Decision.** `flickos-control` is a CLI with a GUI on top:

- `flickos-control` opens the window, and `--page ID` opens a given page.
- `list` prints the page ids and names.
- `get KEY` and `set KEY VALUE` read and change its own settings.
- `prepare` (session start) and `idle` (autostart) are covered in ADR-006 and ADR-009.

Pages for other FlickOS tools call those tools' CLIs. They never import their
code or write their files. A missing CLI is added to the tool that owns the
setting, for example `flick-tiler gap N` and `flick-tiler floating
list|add|remove PATTERN` (flick-tiler 1.3; `float` was already taken by "float
the focused window"), and that package
gets a changelog bump.

**Consequences.** Every setting can be tested and scripted without a display.
There is one owner per setting file, so no two programs race on
`~/.config/flickos/tiler`. Where tab-separated output isn't enough for a page,
the owning tool gets a `--json` option. (Phase 1 needed none: the
tab-separated `list` output, `flick-tiler status` JSON and the aligned
`flickos-shortcuts list` text were enough. `get`/`set` arrive with the first
settings flickos-control owns itself, in phase 2.)

**Alternatives rejected.** Importing `flickos-layout` as a module: it's not a
library, and changes there would silently break the Settings window.

### ADR-005: Where settings are stored

**Decision.** User choices go in `~/.config/flickos/TOPIC` (INI). System
defaults go in conffiles `/etc/xdg/flickos/TOPIC.conf`. The lookup order is the
same as for layouts and the tiler: user file, then system file, then the
built-in default. An unknown value falls back with a warning. Settings of
another tool stay in that tool's files (ADR-004).

**Consequences.** Administrators can change defaults for all users without
editing packaged files. Nothing is copied into `$HOME` until the user changes
something.

### ADR-006: labwc options through a second overlay fragment

**Context.** Touchpad, mouse and key-repeat options are rc.xml settings. labwc
reads only the first rc.xml it finds and never merges files. FlickOS already
generates an overlay rc.xml: `flickos-layout`'s `update_rcxml()` starts from the
system rc.xml, applies layout, style and clicks, and merges flick-tiler's
fragment `$XDG_RUNTIME_DIR/flickos/tiler/labwc.xml` (`tiler_fragment()`,
`merge_fragment()`). `flickos-layout reconfigure` regenerates it and reloads labwc.

**Decision.**
- `flickos-control prepare` writes `$XDG_RUNTIME_DIR/flickos/control/labwc.xml` with `<libinput>` device categories and `<keyboard>` options (`repeatRate`, `repeatDelay`, `numlock`), and `control/environment` with the keyboard layout (ADR-008). A file that isn't needed is deleted. `flickos-session` runs it right before `flickos-layout prepare`.
- In `flickos-layout`, `tiler_fragment()` becomes a list of fragments (`FRAGMENTS`: control, then tiler, merged in that order). `merge_fragment()` learns two more sections:
  - `libinput`: the fragment's `<device>` elements are **appended** to the last `<libinput>`. labwc picks one category per device, the last one of a matching type, so appended categories win over the system rc.xml's, while an administrator's category for a named device still wins over a type (phase 0, S1).
  - `keyboard`: options are set with `set_option()`, keybinds are left alone.
- `flickos-layout` also generates the overlay `labwc/environment`: the system `environment` (flickos-settings' `XCURSOR_*` lines), then the control fragment's lines. labwc reads only the first `environment` it finds, so the overlay copy must contain everything (S2).
- Every managed option is always written with an explicit value, including the one that matches the default. labwc never resets an option that disappears from the config: an unset libinput option keeps the device's current value after Reconfigure, and a removed environment variable keeps its old value (S1, S2).
- A change in the window runs `flickos-control set`, which rewrites the fragment and then runs `flickos-layout reconfigure`, so it applies at once.

**Consequences.** flickos-layouts gets a small change and a version bump, and
flickos-control Depends on `flickos-layouts (>= that version)`. Unit tests must
cover the merge order. `flickos-layout doctor` also reports that input settings
don't apply when a user's own `~/.config/labwc/rc.xml` hides the overlay, and
that the keyboard layout doesn't apply when `~/.config/labwc/environment` exists.

**Alternatives rejected.**
- flickos-layout reading the control settings itself: it ties two packages' settings together.
- Writing `~/.config/labwc/rc.xml`: forbidden by the overlay invariant, and it would stop FlickOS updates from reaching the user.

### ADR-007: System settings through systemd services and polkit

**Context.** Keyboard layout, time zone and autologin are system-wide and need
root. The Settings window must not run as root.

**Decision.** Use the systemd D-Bus services that already do this with polkit
authorization, where Debian allows it:

| Setting | How |
|---|---|
| Time zone, network time | `timedatectl set-timezone`, `set-ntp` |
| Hostname | `hostnamectl hostname` |

The system keyboard layout can't go through localed on Debian: systemd ships
`/usr/share/dbus-1/system.d/systemd-localed-read-only.conf`, which denies
`SetX11Keyboard`, `SetVConsoleKeyboard` and `SetLocale` to everyone, root
included (phase 0, S3).

For the system keyboard layout and for autologin, add a small helper
`/usr/libexec/flickos/control-helper`, run through `pkexec`, with one polkit
action per verb (`org.flickos.control.keyboard`, `org.flickos.control.autologin`,
both `auth_admin_keep`). It accepts only fixed verbs:

- `keyboard MODEL LAYOUT VARIANT OPTIONS`: every value is checked against `/usr/share/X11/xkb/rules/evdev.lst`. It rewrites the four `XKB*` lines of `/etc/default/keyboard` (keeping `BACKSPACE` and any other lines), then runs `udevadm trigger --subsystem-match=input --action=change` and `setupcon -k` if present. This is the procedure in keyboard(5). The file belongs to keyboard-configuration, is written by Calamares, and is meant to be edited this way.
- `autologin-on USER`, `autologin-off`: checks that USER is an existing regular user, and changes membership in the `autologin` group.

**Consequences.** The only new root code is a short helper that can be reviewed
in one go. The password prompt comes from mate-polkit, which is already running.

**Alternatives rejected.** Running the whole window with pkexec (a GTK app as
root under Wayland), or sudo prompts in a terminal.

### ADR-008: Keyboard layout: per user, applied at once; system-wide on request

**Context.** labwc takes the layout from `XKB_DEFAULT_*` environment variables.
`flickos-session` and the greeter set them from `/etc/default/keyboard` at login.
Phase 0 showed that labwc 0.8.3 reads `environment` from the overlay's XDG
config dir, reads it again on Reconfigure (SIGHUP), and then rebuilds each
keyboard's keymap from `XKB_*` (S2). The system-wide route needs root (ADR-007).

**Decision.**
- The Keyboard page's layout is per user and applies at once, without a password. It is stored in `~/.config/flickos/keyboard` (`Model=`, `Layout=`, `Variant=`, `Options=`). `flickos-control prepare` writes all four `XKB_DEFAULT_*` lines into the control `environment` fragment (ADR-006), always explicitly.
- Choosing "Same as the system" deletes the user file, and the fragment then holds `/etc/default/keyboard`'s values until the next login. Values have to be explicit because labwc keeps a variable that is removed from the file (S2). An empty `XKB_DEFAULT_LAYOUT` is never written, because labwc treats it as a broken keymap and falls back to `us`.
- A separate **Use for the login screen and console** button changes `/etc/default/keyboard` through the helper (ADR-007). This is what a single-user laptop wants, and the greeter and new accounts follow.

**Consequences.** Changing the layout needs no root and no re-login. Two users
on one machine can have different layouts. A user's own
`~/.config/labwc/environment` hides the overlay's copy (confirmed in S2), and
`doctor` reports it.

### ADR-009: Idle and lock timeouts move out of autostart

**Context.** autostart starts swayidle with fixed timeouts, and not in the live
session.

**Decision.** autostart runs `flickos-control idle` when it is installed, and
otherwise the current swayidle line (the same `command -v` fallback autostart
uses elsewhere). `idle` reads `~/.config/flickos/idle`, then
`/etc/xdg/flickos/idle.conf` (`Lock=300`, `Suspend=900`, 0 = never), and execs
swayidle. After a change, `set` stops only FlickOS's own swayidle, found by its
command line the way `managed_waybars()` finds waybar, and starts a new one.
Nothing starts in the live session.

**Consequences.** flickos-settings (autostart) gets a version bump. A user who
starts their own swayidle is left alone.

### ADR-010: Menu integration

**Decision.** Keep the *Settings* submenu, and add **All Settings** as its first
item, followed by a separator. Change both `packages/flickos-settings/etc/xdg/labwc/menu.xml`
and the live copy in flickos-installer, so `tools/check-menus.py` passes. Add
`usr/share/applications/flickos-control.desktop` (`Categories=Settings;`) so
fuzzel finds it. Later, the menu items for FlickOS pages can point to
`flickos-control --page ID`.

**Alternatives rejected.** Replacing the submenu with one entry: it removes the
one-click access users already know. This can be revisited (section 5).

### ADR-011: Verification

**Decision.**
- Everything outside GTK (settings lookup, fragment XML, the CLI) has unit tests in `packages/flickos-control/tests/`, run at package build (`override_dh_auto_test`).
- `tools/boot-test.py` gets a `CHECKS` entry: `flickos-control list` exits 0 and lists `layout`.
- Before an rc.xml key is used, a spike confirms that labwc 0.8.3 (trixie) accepts it, because labwc silently ignores keys it doesn't know. The confirmed keys are recorded in phase 0 below.
- The tests hold the list of `<libinput>` and `<keyboard>` keys and values from labwc 0.8.3's `src/config/rcxml.c` (phase 0, S1) as a fixture, and fail if the fragment writer emits anything else. Refresh the list when Debian ships a new labwc, the same way `tools/check-palette.py` holds the valid labwc theme keys.
- The boot test opens each page under both styles and saves screenshots (`boot-test/control-PAGE-dark.png`, `-light.png`), so every CI run produces a gallery to review.
- Touchpad behavior is tested in the VM with a virtual touchpad: a real one recorded once with `evemu-record` (evemu-tools) and created with `evemu-device`. libinput treats it as real hardware. Once per release, a live USB is also checked on a real laptop.

## 4. Phases

### Phase 0: Spikes (done 2026-09-22)

Method: the labwc 0.8.3-1 source (`apt source labwc`), and labwc 0.8.3 from
unpacked trixie .debs run headless (`WLR_BACKENDS=headless`, no sudo) with an
overlay config dir first in `XDG_CONFIG_DIRS`. The headless backend has no input
devices, so what labwc does *to a device* is confirmed from the source only.
The installed-VM tests in phase 2 cover that.

**S1: `<libinput>` in labwc 0.8.3** (`src/config/rcxml.c`
`fill_libinput_category()`, `src/seat.c` `configure_libinput()`)

- Structure: `<libinput><device category="…">…</device></libinput>`. `category` is `default`, `touchpad` (any pointer with tap fingers), `touch` (touchscreens and tablets), `non-touch` (mice, trackpoints), or else a device name.
- Keys and values (names are case-insensitive, unknown keys are ignored without a message):

  | Key | Values |
  |---|---|
  | `naturalScroll`, `leftHanded`, `tap`, `tapAndDrag`, `dragLock`, `middleEmulation`, `disableWhileTyping` | yes/no (labwc's bool parser) |
  | `pointerSpeed` | −1.0 to 1.0 (clamped) |
  | `accelProfile` | `flat`, `adaptive` |
  | `tapButtonMap` | `lrm`, `lmr` (case-sensitive) |
  | `clickMethod` | `none`, `clickfinger`, `buttonAreas` |
  | `sendEventsMode` | yes, no, `disabledOnExternalMouse` |
  | `scrollFactor` | a number (applied by labwc to scroll events) |
  | `calibrationMatrix` | six floats (touchscreens) |

- Each device uses exactly **one** category, with no merging of fields between them: a name match first, then its type, then `default`. Among several of the same kind, the last one wins. labwc adds a `default` category when the config has none.
- `tap` defaults to **enabled** in labwc (libinput's default is off). The other options default to "not set", which means labwc doesn't touch them.
- Reconfigure (SIGHUP) calls `configure_libinput()` again for every pointer and touch device, so changes apply at once. An option that is no longer set is **not** reset, so the device keeps its old value. Hence explicit values (ADR-006).
- Runtime: an overlay rc.xml with a `<libinput>` block parsed without errors in the headless labwc.

**S2: `environment` from XDG_CONFIG_DIRS and the keyboard layout** (`src/config/session.c`, `src/common/dir.c`, `src/input/keyboard.c`)

- labwc looks for `labwc/environment` (and `environment.d/*.env`) in `XDG_CONFIG_HOME`, then in each `XDG_CONFIG_DIRS` entry, and uses only the **first** one found (without `--merge-config`). Values override inherited variables (`setenv(…, 1)`).
- SIGHUP re-reads the file (`handle_sighup()` → `session_environment_init()`), then `seat_reconfigure()` → `keyboard_configure()` → `set_layout()` builds a new keymap from `XKB_DEFAULT_*` and applies it if it differs.
- Runtime, with a window rule printing the variables to a file on each new window:

  | Step | Result |
  |---|---|
  | Start with overlay `FLICK_P0=one`, `XKB_DEFAULT_LAYOUT=de` | `one de` |
  | Change to `two`/`fr`, SIGHUP | `two fr` |
  | Remove the `XKB_DEFAULT_LAYOUT` line, SIGHUP | `three fr` (the variable is **kept**) |
  | Create `~/.config/labwc/environment`, SIGHUP | `user fr` (the user file **hides** the overlay's) |

- flickos-settings ships `/etc/xdg/labwc/environment` (`XCURSOR_THEME`, `XCURSOR_SIZE`), so the overlay copy must include those lines (ADR-006).

**S3: `localectl` on trixie** (systemd 257.13-1~deb13u1)

- Not usable. `systemd-localed-read-only.conf` denies `SetX11Keyboard`, `SetVConsoleKeyboard` and `SetLocale` to everyone, root included, and a drop-in makes `/etc/X11/xorg.conf.d/` read-only for localed. Debian's comment: keymaps are set "from legacy and incompatible components".
- `/etc/default/keyboard` belongs to keyboard-configuration (a dependency of `console-setup`, a Recommends of flickos-desktop). keyboard(5) documents editing it, then `udevadm trigger --subsystem-match=input --action=change` and `setupcon`. The greeter (`usr/libexec/flickos/greeter`) and `flickos-session` both read it at start.
- Result: the helper writes the file (ADR-007), and the per-user layout goes through the overlay (ADR-008). Still to check in the phase 2 VM tests: a new greeter start picks up a changed file, and `setupcon -k` works without a console.

**S4: GTK 3 look** (mock-up with `GtkStackSidebar`, `GtkListBox` rows with `GtkSwitch`, `GtkScale` and `GtkComboBoxText`, and a `GtkFlowBox` of launch tiles; headless labwc with the FlickOS labwc themes, arc-theme 20221218 and Numix-Circle, screenshots with grim)

- Arc-Dark and Arc both style every widget correctly, with no CSS of our own: blue selection in the sidebar, Arc switches and sliders, dimmed subtitles. The labwc title bar uses FlickOS-Arc-Dark/FlickOS-Arc as expected. Stock widgets are enough.
- Use server-side decorations (a plain `GtkWindow`, no `GtkHeaderBar`), like the other FlickOS tools, so the title bar matches every other window.
- The tile page's `GtkFlowBox` stretches rows to fill the height. Set `valign = START` (and homogeneous tiles) in phase 1.

### Phase 1: The hub (done 2026-09-22, flickos-control 1.0)

What was built differs from the scope below in two points:

- **No `--json` anywhere, no `get`/`set` yet** (see ADR-004).
- **The pages re-read the current state when shown** (Super+T, the panel
  button and the chooser change it too).

Verified: unit tests (flickos-control 15, flick-tiler 41) at package build;
lintian shows only the tags every FlickOS package has; the real window was
driven in a headless labwc 0.8.3 with the source-tree commands (layout, clicks,
style set live with the GTK theme following, tiling on/off from the switch and
from outside, the floating list, the width and gap sliders (the gap reaches
the overlay rc.xml; labwc 0.8.3 applies `<core><gap>` to region-tiled windows
in `view_apply_region_geometry()`), the shortcut list), and
screenshotted under both styles. Not yet run: the boot test on a built ISO.

Scope:

- New `packages/flickos-control/`: `debian/` copied from flickos-shortcuts, `usr/bin/flickos-control`, the `.desktop` file, and `tests/`.
- Pages:
  - **Desktop Layout & Style**: layout list with `preview.png`, style and desktop clicks, all through `flickos-layout list/current/set`, `style …` and `clicks …`.
  - **Tiling**: on/off, arrangement, main width, gap and floating apps, through `flick-tiler status/mode/ratio/on/off` and the new `gap` and `floating` commands.
  - **Keyboard Shortcuts**: the sheet (`flickos-shortcuts show`) or the list (`flickos-shortcuts list`).
- Launch tiles for Wallpaper, Appearance, Displays, Network, Sound, Bluetooth, Printers and Software Updates. A tile is hidden when its app isn't installed (Recommends can be removed).
- Menus in both packages (ADR-010), flickos-desktop Depends, `REQUIRED`, and the boot-test check.

Version bumps: flickos-control (new), flickos-desktop, flickos-settings,
flickos-installer, flick-tiler.

Docs: `docs/04-packages.md`, the "where to change what" table in
`docs/01-overview.md`, `docs/09-customizing.md`, and the package list in `CLAUDE.md`.

**Done when** the ISO builds and the boot test passes, every tile opens its app,
and layout, style and click changes apply at once in the live session.

### Phase 2: Input (done 2026-09-22)

Built as planned, with these details settled on the way:

- **"default" stores the default.** For an option with a known default
  (`SETTINGS`), `set KEY default` writes that value, so labwc changes back at
  once. Only the touchpad's click method has none (it depends on the device):
  *Device default* removes it and comes back at the next login, and the page
  says so.
- **Going back to the system layout also drops the variant**, which belonged to
  the chosen layout (found by the headless test).
- **Left out for now:** left-handed for touchpads (only mice), more than one
  layout and XKB options on the Keyboard page (the system's options are kept),
  and the initramfs keymap (the passphrase prompt of an encrypted disk keeps
  the installer's layout; it would need `update-initramfs -u`).
- **The console** gets the system layout at the next boot (`setupcon
  --save-only -k`: safe while the desktop owns the screen).

Verified: unit tests at package build (flickos-control 33, including every
option and choice against labwc 0.8.3's list and the helper; flickos-layouts
168, including merge order, the libinput append after an administrator's
categories and the environment overlay); lintian as before; the polkit policy
against polkit's DTD; the pages driven in a headless labwc 0.8.3 (15 checks:
touchpad and mouse options, the click method, repeat delay, a layout and its
variant into the environment overlay after the `XCURSOR_*` lines, and back to
the system layout), with no labwc config errors, and screenshots under both
styles. Not yet run: the boot test on a built ISO, a real or evemu touchpad
(the headless backend has no input devices), and the pkexec password prompt.

Scope:

- **Mouse & Touchpad** page: a *Touchpad* group (category `touchpad`: tap to click, natural scrolling, disable while typing, pointer speed, click method) and a *Mouse* group (category `non-touch`: left-handed, natural scrolling, pointer speed, acceleration). Keys as listed under S1.
- **Keyboard** page: layout per user plus the system button (ADR-008), repeat rate and delay, Num Lock at login.
- `flickos-control prepare` in `flickos-session`; the fragment list, `libinput`/`keyboard` merging and the generated `environment` in `flickos-layout` (ADR-006); `doctor` coverage; the helper's `keyboard` verb and polkit action (ADR-007).

Version bumps: flickos-control, flickos-layouts, flickos-settings.

**Done when**, on an installed VM (`tools/test-iso.sh --install`), tap to click
toggles at once, and settings survive a re-login and a package upgrade.

### Phase 3: System and session (done 2026-09-22)

Built as planned (ADR-007, ADR-009), plus what the pages needed elsewhere:

- **Network time was missing altogether.** systemd only *recommends*
  systemd-timesyncd, and the image installs no Recommends, so FlickOS systems
  never set their clock. flickos-desktop now depends on it; the page's switch
  is greyed out without it (`CanNTP`).
- **Default apps only mean something if FlickOS's own keys follow them.**
  Super+Enter and the menu ran `foot`, Super+B `x-www-browser` (system-wide),
  Super+E `pcmanfm`. Now: `xdg-terminal-exec` (in trixie; its list
  `~/.config/xdg-terminals.list`, FlickOS's default in
  `/etc/xdg/flickos/xdg-terminals.list`) and flickos-settings'
  `/usr/libexec/flickos/open-default browser|files` (the `mimeapps.list`
  default, else the old command). fuzzel opens terminal apps with
  `xdg-terminal-exec` too; flickos-shortcuts 1.1 describes the new commands.
  pcmanfm's *Open in Terminal* still uses Debian's `x-terminal-emulator`.
- **Autologin is for the calling user only**: the helper's verbs take no user
  name and use pkexec's `PKEXEC_UID`, which is stricter than the ADR's
  `autologin-on USER`. On sets the group to that user alone (the greeter
  logs in the first member).
- **The app lists don't rely on mimeinfo.cache.** GLib's
  `get_all_for_type()` reads the cache `update-desktop-database` writes; the
  page also offers every app whose own `MimeType=` lists the type.
- **The panel clock should follow a new time zone** without a restart: waybar
  0.12 asks for the local zone on every update (`current_zone()` in its clock
  module). Not yet seen in a VM.
- Not done: setting the time by hand (with network time off), and the
  keymap of the encrypted-disk prompt (phase 2).

Verified: unit tests (flickos-control 70, including the idle command and
which swayidle is restarted, the terminal list order, time zones, page
availability and the helper's autologin checks; flickos-shortcuts 20); the
three-action polkit policy against polkit's DTD; lintian and the file-overlap
check; the pages in a headless labwc 0.8.3 with trixie's swayidle,
xdg-terminal-exec and desktop-file-utils (11 checks: swayidle started with its
mark, restarted once with new times, no suspend when never; a browser chosen
on the page is what open-default starts; a terminal chosen there is what
xdg-terminal-exec starts; the time zone shown), and screenshots. Found on the
way: the lock command's constant had the name of the window's lock file
(swayidle got `control.lock`); fixed, and the test now checks the command
itself. Not yet run: the boot test on a built ISO, a real time zone change
(polkit prompt), autologin with the greeter.

Scope:

- **Power & Idle**: lock and suspend timeouts (ADR-009).
- **Date & Time**: time zone and network time through `timedatectl`. Night light (`usr/libexec/flickos/night-light`) follows the time zone, so it is restarted after a change.
- **Default Applications**: web browser, file manager, terminal and text editor through `xdg-mime`.
- **Login**: autologin through the helper's `autologin-*` verbs and polkit action (ADR-007; the helper itself arrives in phase 2). Installed systems only; the page is hidden with `boot=live`.

Version bumps: flickos-control, flickos-settings.

**Done when** every page works on an installed VM without opening a terminal.

### Phase 4: About (done 2026-09-22)

FlickOS version (from `/usr/lib/flickos-release`), Debian and Linux versions,
computer (DMI names, without firmware placeholders), processor, memory,
graphics (`lspci -mm`), disk space and desktop (labwc version, layout, style),
with **Copy System Info** and **Report a Problem** (the installer's
`supportUrl`, GitHub issues). `flickos-control about` prints the same text,
plus the versions of FlickOS's installed packages: the page is a view of it.

- **Copy uses `wl-copy`**, not GTK's clipboard. A Wayland client may only take
  the clipboard with the serial of a recent input event; wl-copy uses the
  data-control protocol (as cliphist does), which needs none, and the text
  stays after the window closes. GTK's clipboard remains the fallback. (Found
  because the headless test, which has no input, got an empty clipboard.)
- **Icons are chosen with `has_icon()`.** GTK 3 tries every name of a list in
  one theme before the next theme, so with `[flickos, distributor-logo…]`
  Numix-Circle's Debian logo beat hicolor's FlickOS logo. The logo and the More
  Settings tiles now use the first name the theme chain has at all.

Verified: unit tests (flickos-control 75: parsing of the release file,
`/proc` and `lspci`, firmware placeholders, the report text); in the headless
labwc, the page under both styles, and *Copy System Info* checked with
`wl-paste`. Not yet run: the boot test (it checks `flickos-control about` for
the version and the packages).

## 5. Risks and open questions

- **User rc.xml.** A `~/.config/labwc/rc.xml` hides the whole overlay, so layout, clicks, tiling and input settings don't apply. Pages that depend on the overlay show a notice based on `flickos-layout doctor`.
- **flickos-layout keeps growing.** The fragment generalisation (ADR-006) must stay small and well tested. If more fragments appear, a fragment directory could replace the fixed list.
- **Existing installs.** New programs reach them only through flickos-desktop's Depends, because the `00recommends` apt config stays on installed systems.
- **Unknown labwc keys.** They are ignored without an error. Only keys confirmed in phase 0 are used, the key-list fixture (ADR-011) catches typos, and a labwc upgrade (0.9 in forky) means checking S1 and S2 again.
- **Device behavior is confirmed from source only.** The headless spike had no input devices, so the phase 2 VM tests with an evemu touchpad are the first real check of `configure_libinput()`.
- **Open question:** once the Settings window has settled, should the *Settings* submenu shrink to a single entry?
