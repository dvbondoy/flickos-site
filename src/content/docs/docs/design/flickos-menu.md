---
title: Start menu (flickos-menu)
description: This document records why the start menu is built the way it is.
sidebar:
  order: 2
---
**Status:** Accepted, 2026-09-24. Phases 0 (spikes), 1 (the menu and the
opt-in) and 2 (tap Super) are done, in flickos-menu 1.0 with flickos-layouts
1.15, flickos-control 1.1, flickos-shortcuts 1.2, flickos-installer 1.13 and
flickos-desktop 1.17. Phase 4 (a menu style per layout) is done in
flickos-menu 1.2 with flickos-layouts 1.17. Phase 3 is ideas. The package
itself is described in
[04](../04-packages.md#flickos-menu), and how to change it in
[09](../09-customizing.md#start-menu).

This document records why the start menu is built the way it is.

- [1. Problem](#1-problem)
- [2. Goals and non-goals](#2-goals-and-non-goals)
- [3. Decisions (ADRs)](#3-decisions-adrs)
- [4. Phases](#4-phases)
- [5. Risks and open questions](#5-risks-and-open-questions)

## 1. Problem

Every layout's apps button (`custom/launcher` in flickos-layouts'
`layouts/common/modules.jsonc`) and Super+D open fuzzel: a search box with a
flat list. Users coming from Windows expect a start menu with pinned apps, all
apps by category, their folders and power buttons, opened by tapping the
Windows key.

## 2. Goals and non-goals

**Goals**
- A classic (Windows 7-style) two-column menu: pinned apps, All apps by
  category, search; the user, their folders, Settings, Software, lock, log
  out, restart, shut down.
- **Optional.** fuzzel stays the default. Users turn the menu on in *Settings →
  Desktop Layout & Style*. While it is off, nothing of it runs and every
  generated file is the same as without it.
- When it is on, all layouts use it, in the corner of their apps button, and a
  tap of Super opens it. Holding Super still shows the shortcut sheet.
- Fast (a click shows it within 100 ms, a keystroke updates the search within
  one frame) and light (no CPU while idle).

**Non-goals**
- Replacing fuzzel: Super+D, Alt+F3 and the clipboard picker stay fuzzel.
- Recent files, jump lists, web search.
- Running on compositors other than labwc.

## 3. Decisions (ADRs)

### ADR-001: Our own package, not nwg-menu or nwg-panel

**Decision.** A new native package, `flickos-menu`: one Python 3 file, GTK 3
and gtk-layer-shell, like flickos-shortcuts and flickos-control.

**Alternatives rejected.**
- **nwg-panel:** its taskbar exists only for sway, Hyprland and niri, so on
  labwc Redmond would lose its window list. It also copies its config, CSS,
  icons and scripts into `~/.config/nwg-panel` at every start, which breaks the
  layout overlay rule.
- **nwg-menu:** not in Debian, a second compiled package (Go). It copies its
  CSS into `~/.config/nwg-panel` at every start, and `-s` can't point at the
  overlay. It launches `Exec=` itself (no `Path=`, D-Bus activation or the
  user's terminal), and `-o` works only on sway and Hyprland.
- **labwc's root menu as a start menu:** labwc 0.8 has no command to open a
  menu from the panel, and it has no search.
- **sfwbar's app menu:** Redmond's panel is waybar.

### ADR-002: flickos-layouts owns the on/off choice

**Decision.** A fourth choice next to layout, style and desktop clicks:
`flickos-layout launcher list|current|set fuzzel|menu` and
`set --launcher`. It is saved in `~/.config/flickos/launcher`, and the system
default is `Launcher=fuzzel` in `/etc/xdg/flickos/layouts.conf`. The Settings
page shows the choice while `launcher list` has two entries (flickos-menu is
installed).

The menu is **on** for a session when the choice is `menu`, flickos-menu is
installed, and the layout has a `Menu=` corner (all three do). Then `prepare`:
- writes the corner to `$XDG_RUNTIME_DIR/flickos/menu/anchor`;
- adds `Super_L` and `Super_R` `onRelease` keybinds to the overlay rc.xml;
- makes every desktop click also close the menu (`MENU_CLICK_ACTIONS`);
- points the generated waybar's `custom/launcher` at the menu.

`panel` starts `flickos-menu daemon` under `supervise` next to mako, waybar and
the dock. `set` starts it when the menu is on and not running, and stops it
when it is off (`sync_menu`). The anchor file is the one runtime signal the
menu and its client read: without it the client runs fuzzel and never starts
a daemon, and a running daemon quits.

**Why there.** flickos-layouts already generates everything the choice
changes (bars, rc.xml overlay with desktop clicks, supervised panel
programs). The overlay rule then holds for free: nothing is written to
`$HOME` except the choice, and off means the overlay is exactly what it was.

**Why a Depends of flickos-desktop.** A Recommends never reaches installed
systems. Installed but off, it costs about 50 KB of disk and nothing else.
flickos-layouts doesn't depend on it; it checks whether it is installed.

### ADR-003: A resident daemon that answers signals

**Decision.** `flickos-menu daemon` keeps the window built and hidden. The
panel button runs `pkill -USR1 -U "$(id -u)" -x flickos-menu || flickos-menu toggle`,
the Super tap `pkill -USR2 …`, a desktop click `pkill -WINCH …`. GLib watches
the three signals (it can watch SIGUSR1, SIGUSR2 and SIGWINCH besides the ones
that end a program). `show` has no signal of its own: the client writes
`menu/request` and sends SIGUSR1.

- **pkill, not Python:** Python starts in about 30 ms on the dev host, plus
  about 10 ms to compile a script this size. pkill takes about 1 ms.
- **The daemon's process name** is `flickos-menu` (the script's name), which
  pkill, flickos-layout's `managed_menus()` and the client's pid check use. The
  client starts it with `exec` of the script itself so the name stays.
- **The pid** is in `menu/daemon.pid`, which is also the flock that keeps it to
  one per session. It is removed on a clean exit; the client checks
  `/proc/PID/comm` before signalling a pid from it.
- **The signal sources run at default priority.** At high priority GLib can
  dispatch one while GDK has a Wayland read pending, and mapping a layer-shell
  window from it then waits for that read forever (found in phase 1:
  `wl_display_roundtrip_queue` in `gtk_widget_map`).
- **Until GTK is ready,** Python handlers queue the requests: a signal without
  a handler would end the process.

**Alternative rejected.** A process per click: 0 MB while idle, but about
0.5 s per open (GTK import, app scan, icons).

### ADR-004: Closing without a full-screen backdrop

**Decision.** The menu closes on Escape, on launching something, on a second
toggle, on focus-out (another window was clicked) and on a desktop click
(labwc doesn't move the keyboard focus for those, so `MENU_CLICK_ACTIONS` sends
SIGWINCH). Keyboard mode `ON_DEMAND`.

**Alternative rejected.** nwg-menu's transparent full-screen layer catches
every outside click, but it costs a full-screen buffer while open (8 MB at
1080p, 33 MB at 4K) and makes labwc blend the whole screen every frame, which is
slow with software rendering.

### ADR-005: A tap of Super: labwc's onRelease keybind, timed by the daemon

**Decision.** `<keybind key="Super_L" onRelease="yes">` (and `Super_R`) in the
overlay. labwc fires it when Super is let go without another key (phase 0,
S1). It also fires after Super+click and Super+drag, and after a long hold, so
the daemon times the press: GDK's `Keymap::state-changed` reports Super even
without keyboard focus, because labwc sends modifier changes to every client
(the same broadcast flickos-shortcuts uses). A request counts only if Super
was pressed alone and let go within `TAP_MS` (600 ms). That's below
flickos-shortcuts' `HOLD_MS` (700), so a hold shows the sheet and never the
menu.

A Super+click shorter than 600 ms still opens the menu. The daemon can't see
pointer events of other surfaces.

### ADR-006: The look comes from the GTK theme

**Decision.** `usr/share/flickos/menu/style.css` uses only GTK's named colors
(`@theme_bg_color`, `@theme_base_color`, `@theme_selected_bg_color`, …). The
Dark and Light styles set the GTK theme (Arc-Dark, Arc), so the menu follows
without palette files; a test checks the CSS has no color literals.
Icons follow the icon theme (Numix-Circle, Numix-Circle-Light).

### ADR-007: Pinned apps

**Decision.** `Pinned=` in the first `flickos/menu.conf` in `XDG_CONFIG_DIRS`:
`/etc/xdg/flickos/menu.conf` (flickos-menu, conffile) on installed systems,
`/etc/xdg/flickos-live/flickos/menu.conf` (flickos-installer, *Install
FlickOS* first) in the live session. Once a user pins or unpins an app
(right-click in the menu, or `flickos-menu pin|unpin ID`), their list in
`~/.config/flickos/menu` replaces it. Apps that aren't installed are left out.
Separate from a layout's `Pinned=` (panel and dock).

### ADR-008: Verification

**Decision.**
- Unit tests in flickos-menu (sections, search ranking and speed, pinned
  files, anchor and pid files, the client's requests while on and off, the Super
  tap timing, the CSS) and flickos-layouts (`StartMenuTest`: off produces the
  same files as before, the overlay while on, turning it off removes
  everything, the daemon's start and stop). Run at package build.
- `tools/boot-test.py`: off by default with nothing running; turned on with the
  daemon supervised and GTK layer shell loaded; the button, the Super keybind,
  the live session's pins; opened in both styles (`menu-light.png`,
  `menu-dark.png`); each layout's menu style after `flickos-layout set`
  (`menu-categories.png`, `menu-grid.png`); turned off with the daemon gone.
- `FLICKOS_MENU_TIMING=1` logs show and search times to
  `$XDG_RUNTIME_DIR/flickos/menu/timing.log`; `flickos-menu bench` times the
  index and search on the installed apps.

### ADR-009: A menu style per layout

**Decision.** Each layout picks its kind of menu with `MenuStyle=` in
`layout.ini`, next to its `Menu=` corner:

| Layout | `MenuStyle=` | Like | What it is |
|---|---|---|---|
| Redmond | `classic` (default) | Windows 7 | Pinned apps and All apps on the left, search below; user, folders, Settings, Software, power on the right |
| Traditional | `categories` | GNOME 2, Xfce's Whisker | Search on top; categories on the left (Favorites = pinned, All apps, the sections, Folders), their apps on the right, switched by pointing at a category; user, Settings, Software, power below |
| Cupertino | `grid` | macOS Launchpad | Every app as a 48 px icon in a full-screen, see-through grid on the overlay layer, search on top; a click on the background, Escape or launching closes it |

- **The user can override it** (added in flickos-layouts 1.17 and
  flickos-control 1.3): a fifth flickos-layout choice,
  `flickos-layout menu-style list|current|set layout|classic|categories|grid`
  (`~/.config/flickos/menu-style`, system default `MenuStyle=layout` in
  `layouts.conf`). `layout`, the default, follows each layout's own
  `MenuStyle=`; any other style is used for every layout, in the layout's
  corner. The Settings page shows it as *Start menu style*, greyed out while
  the apps button is the app launcher.
- **How it gets there.** flickos-layout writes the style as the second line
  of `menu/anchor`. flickos-menu 1.1 reads only the first line and shows the
  classic menu; an unknown style is the classic one too.
- **One view at a time.** flickos-menu splits the old `Menu` into the daemon's
  state (index, icons, pins, Super tap, launching) and a `View` per style
  (`VIEWS`: `ClassicView`, `CategoriesView`, `GridView`) that owns the window.
  Only the current style's window exists; a new style destroys it and builds
  the other. Search, launching, pinning and closing are shared.
- **Ready before it's needed.** `flickos-layout set` sends a running daemon
  SIGWINCH (hide). A hide while hidden makes the daemon check the style and, if
  it changed, build the new view in a low-priority idle. The view's window is
  realized and measured then (`get_preferred_size`), so the first show doesn't
  pay for CSS and layout: 9–23 ms instead of 51–105 ms.
- **The grid** filters and sorts its tiles (`Gtk.FlowBox` filter and sort
  functions) instead of rebuilding them, and shows every match
  (`search(..., limit=None)`). It uses the overlay layer and an exclusive zone
  of -1, so it covers the panel and the dock. It costs a full-screen buffer
  only while open (ADR-004's backdrop was rejected for the menus that don't
  need it; the grid is full-screen by design).

**Alternatives rejected.**
- A true GNOME 2 cascade (a popup per category): GTK 3 popups parented to a
  layer surface are untested on labwc 0.8, and a hover-switched pane in one
  window gives the same use without the risk.
- Building every style up front: about 3 MB more per extra view for nothing.

## 4. Phases

### Phase 0: Spikes (done 2026-09-24)

Headless labwc 0.8.3 from unpacked trixie debs (`WLR_BACKENDS=headless`,
pixman, 1280×720), wtype and wlrctl for input, the host's GTK 3.

- **S1, Super onRelease:** a tap fires it; Super+E and Super+an unbound key
  don't. Super held while the pointer clicks or moves **does** (labwc's
  `cur_keybind` isn't reset by pointer events), and so does a long hold. GDK in
  a process without focus sees Super's state and timing
  (`Keymap::state-changed`). → ADR-005.
- **S2, focus:** ON_DEMAND gives the menu the keyboard; clicking another
  window sends focus-out; clicking the desktop doesn't. → ADR-004. In the
  headless harness a seat has no keyboard until wtype creates one, so the first
  typed key there brings the focus; not so with a real keyboard.
- **S3, launching:** GLib 2.84 launches `Terminal=true` apps through
  `xdg-terminal-exec`, so the user's terminal choice holds.
- **S4, speed and memory:** a layer-shell window of 40 rows maps in 10–13 ms
  after a hide. The Python client starts in about 30 ms. A GTK 3 Python process
  holds about 19 MB private memory before any window.

### Phase 1: The menu and the opt-in (done 2026-09-24)

Measured in the harness on the dev host (77 apps, Arc-Dark and Numix-Circle):

| What | Target | Measured |
|---|---|---|
| Click or Super tap → menu drawn | ≤ 100 ms | 34 ms the first time, then 3–5 ms |
| Keystroke → results | ≤ 16 ms | 1.5–3 ms (80 ms before the icon warm-up below) |
| App index at startup | not in the way | 105 ms, in a low-priority idle |
| Daemon idle | 0 % CPU | 0 %; about 0.65 s CPU once at start |
| Memory | 15–25 MB unique (estimate) | **about 32 MB private** (RSS 75 MB, PSS 46 MB) |

- **Icons are warmed** after each index build, 8 per low-priority idle
  callback: rendering 30 SVG icons for the first search took 80 ms.
- **Memory is above the estimate.** Most of it is Python, the GI typelibs and
  GTK's CSS, font and theme caches (19 MB before any window). The dev host runs
  KDE, so little of GTK is shared there; on FlickOS, waybar, nm-applet and the
  polkit agent share the libraries, which lowers PSS but not the private part.
  It is paid only while the menu is on.
- **Found:** the priority deadlock in ADR-003.

### Phase 2: Tap Super (done 2026-09-24)

The overlay keybinds (flickos-layouts), the tap timing (flickos-menu,
`SuperTap`), and flickos-shortcuts 1.2 describing it as *Start menu (tap)*,
shown once as *Super*.

### Phase 4: A menu style per layout (done 2026-09-24)

ADR-009. Measured in the harness (77 apps, Arc-Dark and Numix-Circle):

| What | Measured |
|---|---|
| Build a view (hidden, after `set`) | classic 40–70 ms (225 ms the very first time: theme and CSS load), categories 38–67 ms, grid 166–200 ms |
| First show after a layout switch | 9–23 ms |
| Grid: keystroke → filtered and sorted | about 3 ms |
| Memory, private (all views after one show) | classic 35 MB, categories 35 MB, grid 38 MB |

### Phase 3: Ideas

- Frequently used apps under the pinned ones.
- Settings pages in the search (`flickos-control --page ID`).
- Keyboard navigation between the columns (the right column is mouse-only).
- Measure memory on an installed FlickOS; drop the All apps widgets after a
  while hidden if it matters.

## 5. Risks and open questions

- **Super+click under 600 ms opens the menu** (ADR-005). Accepted.
- **labwc 0.9 (forky):** re-check that onRelease keybinds and the modifier
  broadcast behave the same.
- **Multi-monitor:** the menu opens on the output labwc picks for a layer
  surface without one; not tested with two outputs.
- **A user's own waybar config** keeps its own apps button; the Super tap still
  opens the menu.
