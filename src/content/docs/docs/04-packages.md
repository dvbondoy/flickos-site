---
title: FlickOS packages
description: "FlickOS's own packages live in packages/. Each is a native Debian source package: a folder with a debian/ directory and the files it installs. They have no…"
sidebar:
  order: 4
---
FlickOS's own packages live in `packages/`. Each is a **native Debian source
package**: a folder with a `debian/` directory and the files it installs. They
have no upstream tarball; this repo *is* the upstream. The exceptions are
`waypaper` and `sfwbar`, third-party apps that Debian trixie lacks, packaged the
same way (see [waypaper](#waypaper) and [sfwbar](#sfwbar)).

## The packages

### `flickos-desktop` (meta-package)

Installs no files. It exists only for its dependencies, which together are
the FlickOS desktop. Everything is in `packages/flickos-desktop/debian/control`.

- **`Depends:`** packages the session can't work without (labwc, waybar,
  PipeWire, portals, polkit, NetworkManager, `flickos-settings`,
  `flickos-archive-keyring`, …). Also `systemd-timesyncd`: systemd only
  *recommends* a time daemon, so without it installed systems never set their
  clock from the network; and `xdg-terminal-exec`, which Super+Enter and the
  menu run.
- **`Recommends:`** apps and tools users may reasonably remove (foot, fuzzel,
  pcmanfm, htop, nano, …).

Why the split matters: if a user removes a package listed in **Depends**, apt
also removes `flickos-desktop`. After that, `apt autoremove` would delete every
package that was only installed for it, which is the whole desktop.
**Recommends** can be removed safely.

Rule: **only put something in Depends if FlickOS is broken without it.**

Because the ISO is built with `--apt-recommends false`, the hook
`config/hooks/normal/0050-flickos-recommends.hook.chroot` installs the
Recommends explicitly.

**Caveat:** live-build leaves `/etc/apt/apt.conf.d/00recommends`
(`APT::Install-Recommends "false";`) in the image, so **installed systems
also skip Recommends.** A package you *add* to `Recommends:` later only
reaches new ISO installs, not existing systems on `apt upgrade`. If existing
users must get a new package, put it in `Depends:`. To switch installed
systems back to Debian's default (install Recommends), add a hook
`0900-restore-recommends.hook.chroot` containing
`rm -f /etc/apt/apt.conf.d/00recommends`. Future `apt install` commands will
then also pull in Recommends, which makes installs larger.

### `flickos-settings`

Default desktop configuration:

| File in package | Installed to | Purpose |
|---|---|---|
| `usr/bin/flickos-session` | `/usr/bin/` | Starts the session: config directories, input settings (`flickos-control prepare`), desktop layout overlay (`flickos-layout prepare`), keyboard layout, `exec labwc`. Run by the login screen and by the tty1 script |
| `etc/profile.d/95-flickos-session.sh` | `/etc/profile.d/` | On tty1 login (live autologin, text login) runs `flickos-session` |
| `usr/share/wayland-sessions/flickos.desktop` | same | The session for other display managers |
| `etc/xdg/labwc/rc.xml`, `menu.xml`, `environment` | `/etc/xdg/labwc/` | Keybindings, root menu, cursor |
| `etc/xdg/labwc/autostart` | `/etc/xdg/labwc/` | Calls `/usr/libexec/flickos/autostart` |
| `usr/libexec/flickos/autostart` | `/usr/libexec/flickos/` | Starts kept screen arrangements (`flickos-control displays start`: kanshi, only while one is kept), wallpaper (`flickos-layout wallpaper`), panel (`flickos-layout panel`), notifications (and Do Not Disturb again: `flickos-control notifications`), applets, night light (`flickos-control night-light`, else the script), idle lock (`flickos-control idle`, else a fixed swayidle), and last the startup applications (`flickos-control startup run`) |
| `usr/libexec/flickos/open-default` | `/usr/libexec/flickos/` | `browser` or `files`: starts the user's default app (`xdg-mime query default`, then `gio launch`), else `x-www-browser` or `pcmanfm`. Super+B, Super+E and the menu |
| `etc/xdg/flickos/` | `/etc/xdg/flickos/` | foot, fuzzel and default-app config: `mimeapps.list`, and `xdg-terminals.list` (foot, for `xdg-terminal-exec`); `autostart/` hides the XDG autostart entries of what autostart starts itself (nm-applet, blueman, the polkit agent, xdg-user-dirs) and keeps the print queue applet off |
| `usr/libexec/flickos/lock` | `/usr/libexec/flickos/` | Locks the screen (Super+L, the menus): `flickos-control lock` (the background chosen in Settings), else `swaylock -f -c 383c4a` |
| `usr/libexec/flickos/night-light` | `/usr/libexec/flickos/` | Starts wlsunset timed for the time zone's city (`zone1970.tab`), passing its own options on (`flickos-control night-light` gives `-t`) |
| `usr/share/flickos/` | `/usr/share/flickos/` | waybar and mako config (the mako config has the `do-not-disturb` mode) |
| `usr/share/backgrounds/flickos/default.jpg` | same | Wallpaper for layouts without their own, and without flickos-layouts |
| `usr/share/glib-2.0/schemas/90_flickos-settings.gschema.override` | same | GTK theme (Arc-Dark), icons (Numix-Circle), fonts, dark mode, title bar buttons of windows that draw their own |
| `usr/share/themes/FlickOS-Arc-Dark/labwc/themerc` | same | labwc window theme in Arc-Dark colors (arc-theme has none for labwc) |
| `usr/share/themes/FlickOS-Arc/labwc/themerc` | same | The same in Arc (light) colors, for the Light style |

Every file is explained in [09 – Customizing](/docs/09-customizing/).

`debian/install` maps source paths to install paths.

**How labwc finds config:** labwc looks for each file first in
`~/.config/labwc/`, then in `/etc/xdg/labwc/`, and uses **the first one it
finds**. It doesn't merge them (see `man labwc-config`). So:

- Users with no personal config get FlickOS defaults, **and get your updates**.
- A user who copies e.g. `rc.xml` to `~/.config/labwc/` takes full control of
  that file and stops receiving your changes to it. The other files still come
  from `/etc/xdg/labwc/`.

**Conffiles:** everything a package installs under `/etc` is a *conffile*. If a
user edited `/etc/xdg/labwc/rc.xml` and you ship a new version, `dpkg` asks
them whether to keep theirs or take yours. It never silently overwrites their
edits. This is normal Debian behavior.

### `flickos-layouts`

Desktop layouts, Dark/Light styles and the `flickos-layout` tool, which applies
the chosen layout and style at login and live (see
[09 – Desktop layouts](/docs/09-customizing/#desktop-layouts) and
[09 – Styles](/docs/09-customizing/#styles-darklight)).

| File in package | Installed to | Purpose |
|---|---|---|
| `usr/bin/flickos-layout` | `/usr/bin/` | Python 3 tool: `list`, `current`, `set`, `style list/current/set`, `clicks list/current/set`, `launcher list/current/set`, `menu-style list/current/set`, `clock list/current/set`, `state` (all of them and doctor's warnings as JSON, for the Settings window), `prepare`, `panel`, `supervise`, `wallpaper`, `doctor`, `pick` (chooser), `first-run`. Every `set` also takes `default` (removes the user's choice), and every change that shows is recorded for *Settings → History* |
| `usr/share/flickos/layouts/ID/` | same | One folder per layout (`redmond`, `cupertino`, `traditional`): `layout.ini`, `waybar.jsonc`, `style.css`, `preview.png`, `wallpaper.jpg` |
| `debian/links` | `/usr/share/backgrounds/flickos/ID.jpg` | Links to the layouts' wallpapers, for waypaper |
| `usr/share/flickos/layouts/common/` | same | `modules.jsonc` and `base.css`, shared by every layout |
| `usr/share/flickos/styles/ID/` | same | One folder per style (`dark`, `light`): `style.ini` (GTK, icon and labwc theme names) and the palettes `waybar-colors.css`, `foot.ini`, `fuzzel.ini`, `mako.conf` |
| `etc/xdg/flickos/layouts.conf` | same | Default layout, style, desktop clicks, apps button, start menu style and clock (conffile) |
| `usr/share/applications/flickos-layout.desktop` | same | *Desktop Layout & Style* in the app launcher (`flickos-layout pick`) |
| `etc/skel/.config/flickos/choose-layout` | same | First-login marker: new accounts see the chooser once (`flickos-layout first-run`). Conffile |
| `debian/flickos-layouts.lintian-overrides` | `/usr/share/lintian/overrides/` | Allows the marker in `/etc/skel` (see below) |
| `tests/` | not installed | Unit tests |

- **Why it's a Depends of `flickos-desktop`:** the session script and autostart
  only use it if it's installed, so FlickOS still starts without it. But a
  *Recommends* never reaches installed systems (see the caveat above), and
  layouts are part of FlickOS for every user. The sanity hook's `REQUIRED` list
  includes it too.
- **It depends on `flickos-settings` (>= 1.10)**, whose `rc.xml`, foot, fuzzel
  and mako configs are the base of the overlay, whose panel is the fallback when
  a layout can't be started, which has the `FlickOS-Arc` window theme and
  (1.10) the default desktop click bindings. flickos-settings in turn
  `Breaks: flickos-layouts (<< 1.6)`: its autostart leaves starting mako to
  `flickos-layout panel` (1.3) and runs `flickos-layout first-run` (1.4) and
  `flickos-layout wallpaper` (1.6), which older versions don't have.
- **It recommends `waypaper`** for the chooser's *Wallpaper…* button, which is
  only shown when waypaper is installed.
- **It ships a file in `/etc/skel`**, which lintian reports as
  `package-contains-file-in-etc-skel` because existing home directories never
  get it. Here that's the point: only accounts created after installation
  (Calamares, `adduser`) should see the first-login chooser. The override in
  `debian/flickos-layouts.lintian-overrides` silences it.
- **It depends on `libglib2.0-bin`** for `gsettings` (the icon theme, to find
  icons for pinned apps in a bar; GTK settings when switching styles) and
  `gio launch` (clicks on those icons).
- **It depends on `sfwbar`** (`+flickos3` or later, which has the `running`
  class and `sensor_maximized`) for the Cupertino dock.
- **It merges other programs' labwc fragments** into the rc.xml overlay
  (`FRAGMENTS`, in this order): flickos-control's `control/labwc.xml`
  (`<libinput>` device categories, appended after the system rc.xml's, and
  `<keyboard>` options) and flick-tiler's `tiler/labwc.xml`. For
  flickos-control's `control/environment` (the keyboard layout) it writes an
  overlay `labwc/environment`: the system one's lines (and its `environment.d/`),
  then the fragment's, since labwc reads only the first environment file it finds.
- **It owns the panel clock's hours** (`clock`: `24h`, the default and the
  layouts' own formats, or `12h`): generating the panel gives each bar with a
  clock its formats with `%I:%M %p` for `%H:%M` (the bar's own, else the
  include's, else waybar's `{:%H:%M}`). *Settings → Date & Time* sets it.
- **It owns the apps button's choice** (`launcher`: `menu`, flickos-menu's
  start menu, the default while that is installed, or `fuzzel`, the app
  launcher, the only choice without it). While the
  start menu is on, it writes the menu's corner (`Menu=` in `layout.ini`) to
  `menu/anchor`, adds the Super-tap keybinds to the rc.xml overlay, points the
  generated `custom/launcher` and the desktop clicks at the menu, and runs
  `flickos-menu daemon` with the panel. While it is off, none of that exists.
  It doesn't depend on flickos-menu. See [flickos-menu](#flickos-menu).
- **It depends on `python3-gi` and `gir1.2-gtk-3.0`** for the chooser window.
  GTK 3 follows the Arc theme. zenity (GTK 4/libadwaita) was rejected because
  libadwaita ignores Arc and would add about 12 MB. Both packages were already in
  the image.
- **Unit tests run during the build:** `debian/rules` has
  `override_dh_auto_test: python3 -m unittest discover -s tests`, so
  `packages/build.sh` stops if a test fails. That's why `python3` is in
  `Build-Depends`. Skip them with `DEB_BUILD_OPTIONS=nocheck`.
  `PYTHONDONTWRITEBYTECODE=1` in `debian/rules` keeps a `__pycache__` folder from
  ending up next to the installed script.

### `waypaper`

[waypaper](https://github.com/anufrievroman/waypaper), a GTK 3 wallpaper
picker for swaybg (*Settings → Wallpaper*). It isn't in Debian trixie, so
FlickOS packages upstream's release: pure Python, installed as is to
`/usr/lib/python3/dist-packages/waypaper/` with a small `/usr/bin/waypaper`
launcher, so building it needs nothing beyond debhelper. Its dependencies
(python3-gi, python3-pil, python3-imageio, python3-screeninfo,
python3-platformdirs) are all in Debian.

- **Version:** upstream's, plus `+flickosN` (`2.9+flickos1`), so a FlickOS
  change can be released without a new upstream version (`dch -i` bumps N).
- **FlickOS changes** (listed in `debian/README.source`, with how to update to
  a new upstream release): defaults in `/etc/xdg/waypaper/config.ini`, which a
  patched `config.py` reads before the user's config, and the desktop file
  without its `#!` line.
- **A Depends of `flickos-desktop`**, not a Recommends, so installed systems
  get it: the Settings menu has an entry for it.
- **License:** GPL-3+ (`debian/copyright`), like FlickOS's own files.

### `sfwbar`

[sfwbar](https://github.com/LBCrion/sfwbar), a GTK 3 layer-shell panel for
stacking Wayland compositors, meant as the Cupertino layout's dock: a taskbar
with pinned apps that hides and slides back up when the pointer touches the
bottom edge (`sensor`), without reserving screen space (`exclusive_zone = "0"`).
Debian packaged it up to 1.0~beta13, then removed it, so FlickOS packages
upstream's source.

- **The only compiled FlickOS package:** `Architecture: any`, built with meson
  by `debian/rules`. Its `Build-Depends` (meson, gettext, GTK 3,
  gtk-layer-shell, json-c, Wayland headers) must be on the build host and are
  installed in CI. The optional features are set explicitly in `debian/rules`,
  so the result doesn't depend on which `-dev` packages the host has: the
  pulse, pipewire, alsa and xkbmap modules are off. It builds no `-dbgsym`
  package, because `packages/build.sh` stages every `.deb` it finds.
- **A git commit, not a release:** 1.0_beta17 documents taskbar `pins` but
  only implements them for the pager, and its `size = "auto"` bars collapse to
  1px. The vendored commit (in `debian/README.source`, with update steps) has
  both working. Version: `1.0~beta17+git20260910+flickosN`, which sorts after
  beta17 and before `1.0~beta18+flickos1`.
- **FlickOS changes** (listed in `debian/README.source`, marked `FlickOS:` in
  the code): an app's dock button gets the CSS class `running` while the app has
  a window (the open-app line), and a bar property `sensor_maximized`: the dock
  hides only while the active window is maximized or fullscreen on its monitor.
- **Used by `flickos-layouts`** (a Depends): `flickos-layout` generates the dock
  config in the layout overlay and runs `sfwbar -f FILE`
  ([The generated panel](/docs/09-customizing/#the-generated-panel)).
- **License:** GPL-3 (version 3 only), protocol files MIT/HPND, weather icons
  MIT (`debian/copyright`).

### `flick-tiler`

Opt-in window tiling for the labwc session: master and stack, columns, grid
and monocle, with gaps. It is off until a user turns it on (Super+T or the
panel button). One Python 3 file, `usr/bin/flick-tiler`, standard library only;
it speaks the few Wayland messages it needs (wlr-foreign-toplevel) itself, so
it needs no bindings.

- **How it tiles:** labwc can't be told to move a window, so flick-tiler
  rewrites labwc *regions* and has labwc reload.
  [09](/docs/09-customizing/#window-tiling) explains the mechanism.
- **Settings:** `/etc/xdg/flickos/tiler.conf` (conffile: `Enabled`, `Mode`,
  `MasterRatio`, `Gap`, `Float`), then the user's `~/.config/flickos/tiler`.
- **Depends on flickos-layouts (>= 1.8)**, whose `flickos-layout reconfigure`
  merges the tiling fragment into the rc.xml overlay, and flickos-settings
  (>= 1.11) for the Super+T binding and the autostart line.
- **Commands for the Settings window** (flickos-control): `flick-tiler floating
  list|add|remove PATTERN` changes the `Float=` list (the whole list goes into
  the user's file, since it replaces the system one), `flick-tiler gap N` the
  gap, and `status` also gives the main window width (`ratio`) and `gap`.
  `mode`, `ratio` and `gap` take `default` (removes the user's value).
- **History:** every change of these settings (Super+T and the panel
  included) is recorded for *Settings → History*, like flickos-layout's (see
  flickos-control).
- **A Depends of `flickos-desktop`** and in the sanity hook's `REQUIRED`.
- **Unit tests** in `tests/` (arrangements, window bookkeeping, fragment, the
  Wayland client against a fake compositor), run at package build like
  flickos-layouts'.

### `flickos-shortcuts`

The keyboard shortcut sheet: hold Super on its own for `HOLD_MS` (0.7 s) and
the session's shortcuts appear in the middle of the screen until Super is let
go. Also *Settings → Keyboard Shortcuts* and the app launcher
(`flickos-shortcuts show`, closes on any key or click). One Python 3 file,
`usr/bin/flickos-shortcuts`, plus `usr/share/flickos/shortcuts/style.css`
(Arc-Dark, in `tools/check-palette.py`).

- **How it sees Super:** labwc 0.8 sends the modifier state to *every* client
  with a keyboard, not only the focused one. The daemon keeps a bare Wayland
  connection with a keyboard (standard library, like flick-tiler's) and reads
  the `modifiers` events; nothing is bound in rc.xml. Other compositors
  (sway, Mutter) don't do this, so the daemon only works on labwc.
- **The sheet** is a GTK 3 layer-shell surface (gtk-layer-shell) on the
  overlay layer. It takes no keyboard focus and lets clicks through, so the
  shortcuts keep working while it is shown.
- **What it lists:** the keybinds of the rc.xml labwc uses (first of
  `$XDG_CONFIG_HOME`, then `$XDG_CONFIG_DIRS`: a user's own, the flickos-layouts
  overlay with flick-tiler's keys while tiling is on, or flickos-settings'),
  plus labwc's built-in ones (`DEFAULT_KEYBINDS`) with `<default />`. Read
  again every time it is shown. Descriptions come from `COMMANDS` and
  `ACTIONS`; media, volume and brightness keys are left out.
- **Started by** flickos-settings' autostart (`flickos-shortcuts daemon`, one
  per session: `$XDG_RUNTIME_DIR/flickos/shortcuts.lock`).
- **A Depends of `flickos-desktop`** and in the sanity hook's `REQUIRED`.
- **Unit tests** in `tests/` (rc.xml reading, descriptions, the hold timing,
  the Wayland client against a fake compositor), run at package build.

### `flickos-menu`

The start menu for the panel's apps button (the default), in the style of the
desktop layout (`MenuStyle=`): Redmond's is classic (Windows 7: pinned apps,
*All Apps* by category and search on the left; the user, their folders,
Settings, Software and the power buttons on the right), Traditional's is
categories (GNOME 2/Whisker), Cupertino's a full-screen grid of app icons
(Launchpad). **On by default** (since flickos-layouts 1.23): a user who wants fuzzel back picks
*App launcher* under *Apps button* in *Settings → Desktop Layout & Style*
(`flickos-layout launcher set fuzzel`). Design and measurements:
[design/flickos-menu.md](https://github.com/dvbondoy/FlickOS/blob/main/docs/design/flickos-menu.md).

| File in package | Installed to | Purpose |
|---|---|---|
| `usr/bin/flickos-menu` | `/usr/bin/` | One Python 3 file: `daemon`, `toggle`, `show`, `hide`, `super`, `list`, `pinned`, `pin`, `unpin`, `bench` |
| `usr/share/flickos/menu/style.css` | same | The look, in GTK theme colors only, so both styles recolor it (in `tools/check-palette.py`) |
| `etc/xdg/flickos/menu.conf` | same | Default pinned apps (conffile). The live session uses flickos-installer's `/etc/xdg/flickos-live/flickos/menu.conf` |
| `tests/` | not installed | Unit tests |

- **Nothing runs while it is off.** flickos-layouts starts `flickos-menu daemon`
  with the panel only while the menu is on, and `flickos-layout launcher set
  fuzzel` stops it. Without `$XDG_RUNTIME_DIR/flickos/menu/anchor` (written by
  flickos-layouts while the menu is on) `toggle` runs fuzzel and no daemon
  starts.
- **Fast:** the daemon keeps the menu built and hidden; the panel button,
  labwc's Super keybind and desktop clicks reach it with `pkill` (SIGUSR1
  toggle, SIGUSR2 Super tap, SIGWINCH hide), so no Python starts per click.
  Showing it takes a few milliseconds; icons are loaded in the background.
- **A tap of Super** is labwc's `onRelease` keybind; the daemon ignores it
  unless Super was pressed alone and let go within `TAP_MS` (600 ms), so a hold
  still shows flickos-shortcuts' sheet.
- **Costs while on:** about 30 MB of private memory and no CPU while idle.
- **Pinned apps:** `Pinned=` in the first `flickos/menu.conf` in
  `XDG_CONFIG_DIRS`, until the user pins or unpins one (right-click an app, or the Menu key);
  then `~/.config/flickos/menu`.
- **Launching** goes through GLib (`Gio.DesktopAppInfo`), so `Terminal=true`
  apps open in the user's terminal (xdg-terminal-exec) and folders in their
  file manager.
- **A Depends of `flickos-desktop`**, so installed systems get it (a Recommends
  wouldn't reach them), and in the sanity hook's `REQUIRED`. It depends on
  `procps` for `pkill`.
- **Unit tests** in `tests/`, run at package build.

### `flickos-control`

The Settings window (*Settings → All Settings*, or `flickos-control` in the
app launcher): one window with a sidebar of pages, and the owner of the mouse,
touchpad, keyboard and idle settings. One Python 3 file,
`usr/bin/flickos-control`, GTK 3 through python3-gi with no CSS of its own, so
it follows the Dark or Light style. Design and decisions:
[design/flickos-control.md](https://github.com/dvbondoy/FlickOS/blob/main/docs/design/flickos-control.md).

- **Pages:** *Desktop Layout & Style* (layout with previews, style, desktop
  clicks), *Displays* (the screens now, *Arrange Screens…* starts wdisplays,
  *Keep This Arrangement*, the kept arrangements; night light on or off and
  its warmth; shown while kanshi and wlr-randr are installed), *Mouse & Touchpad*, *Keyboard* (layout and
  variant, repeat, Num Lock, and the system layout), *Language & Region*
  (language and formats for the account, the system's through `localectl
  set-locale`, which asks for the password; shown while the `locales`
  package is installed), *Default Applications* (browser, file
  manager, text editor, image and document viewer, media player through
  `xdg-mime default`; the terminal through `~/.config/xdg-terminals.list`),
  *Startup Applications* (XDG autostart entries on or off, *Add App…*,
  *Remove*), *Notifications* (Do Not Disturb), *Power & Idle* (lock and sleep times; what the power button, closing the
  lid and closing it while plugged in do, read from logind; the lid rows only
  with a lid switch), *Memory* (how much memory the computer has and uses,
  and *Firefox: use less memory*: the helper's `firefox-memory on|off` writes
  or deletes `/etc/firefox-esr/flickos-memory.js`, default prefs Debian's
  Firefox reads at its next start; recommended when `old_computer()` finds
  at most 3 GiB or no graphics acceleration; `docs/design/flickos-firefox.md`),
  *Date & Time* (time zone and network
  time through `timedatectl`, which asks for the password; night-light is
  restarted for the new time zone), *Updates* (automatically or not, which
  updates, restarting when nobody is logged in; installed systems only),
  *Login* (log in automatically; only on
  installed systems with flickos-greeter), *Users* (add and remove accounts,
  administrator or not, set a password; installed systems only), *Firewall*
  (ufw on or off; shown while ufw is installed), *Tiling* (on/off, arrangement, main window width, gap, apps that
  always float), *Keyboard Shortcuts* (the list, and a button for the sheet),
  *History* (recent changes with *Undo*; see below) and
  *More Settings* (tiles that start Wallpaper, Appearance, Displays, Network,
  Sound, Bluetooth, Printers and Software Updates; a tile is hidden when its app
  isn't installed) and *About* (FlickOS version from `/usr/lib/flickos-release`,
  Debian, Linux, computer, processor, memory, graphics via `lspci`, disk,
  desktop; *Copy System Info* puts the same text plus the FlickOS packages'
  versions on the clipboard with `wl-copy`, and *Report a Problem* opens the
  GitHub issues).
- **Search:** a box above the page list finds pages, the rows and headings
  the pages build (collected by `Ui.row()`/`Ui.heading()` while the window
  opens) and the tiles' apps, also by `SEARCH_KEYWORDS` ("wifi", "volume",
  "monitor"). A result opens the page scrolled to the setting with its
  control focused, or starts the app. Ctrl+F, or a letter typed outside a
  text field, starts a search; Escape clears it.
- **Its own settings** (`SETTINGS`): touchpad (`tap`, natural scrolling,
  disable while typing, pointer speed, click method), mouse (left-handed,
  natural scrolling, pointer speed, acceleration) and keyboard (repeat delay and
  rate, Num Lock, layout, variant), plus `locale.language` and
  `locale.formats` (below). `flickos-control set KEY VALUE` saves one in
  `~/.config/flickos/input` or `keyboard` (system defaults: the conffiles
  `/etc/xdg/flickos/input.conf` and `keyboard.conf`, all commented out),
  writes `$XDG_RUNTIME_DIR/flickos/control/labwc.xml` and `environment`, and runs
  `flickos-layout reconfigure`. `get` lists them. `prepare` writes the two files
  at login (flickos-session runs it before `flickos-layout prepare`). labwc
  never resets an option that disappears from its config, so a value once set
  stays written, and `set KEY default` stores the default rather than
  removing it. Only keys labwc 0.8.3 parses are used; the tests hold its list.
- **Locking:** `flickos-control lock` execs `swaylock -f -c 383c4a` (the
  Arc-Dark color, `lock.background` `color`) or, with `wallpaper`, adds the
  images the user's swaybg shows (`-i OUTPUT:PATH` per `-o` group, `-s` its
  mode). swayidle runs it, and flickos-settings' `/usr/libexec/flickos/lock`
  (Super+L, the menus, the start menu). `idle.lock-before-sleep` (default
  yes) is swayidle's `before-sleep`. `~/.config/flickos/lock`, conffile
  `lock.conf`.
- **Idle:** `flickos-control idle` (run by autostart, not in the live session)
  execs swayidle with the chosen times (`idle.lock-after`,
  `idle.suspend-after`; `~/.config/flickos/idle`, system defaults in the
  conffile `/etc/xdg/flickos/idle.conf`) and `FLICKOS_IDLE=1` in its
  environment. A change stops FlickOS's swayidle (that mark, or autostart's
  old fixed lock command) and starts a new one; a user's own swayidle is left
  alone. It also locks the screen when logind asks (`lock`: the lid set to
  *Lock the screen*, `loginctl lock-session`).
- **Language and formats** (`~/.config/flickos/locale`, no system conffile:
  the system's is `/etc/default/locale`) become `LANG`, `LANGUAGE` (empty),
  `LC_MESSAGES` and the installer's nine `LC_*` format variables in
  `control/environment`, after the keyboard lines; a format the system
  doesn't set follows the language. Apps started afterwards use them, the
  rest from the next login. `set` accepts only a generated locale (`locale
  -a`); the page adds another first through the helper's `locale-add`.
- **Night light** (`night-light.enabled`, default on, and
  `night-light.temperature`, wlsunset's `-t`; `~/.config/flickos/night-light`,
  conffile `/etc/xdg/flickos/night-light.conf`): `flickos-control
  night-light` (autostart) execs flickos-settings' `night-light` script with
  `-t` and `FLICKOS_NIGHT_LIGHT=1`, or nothing while it is off. A change or a
  new time zone restarts only FlickOS's wlsunset (the mark, or the script's
  own `-l -L`/`-S -s` options).
- **Do Not Disturb** (`notifications.do-not-disturb`,
  `~/.config/flickos/notifications`, conffile `notifications.conf`) is
  mako's `do-not-disturb` mode (flickos-settings' mako config: all but
  critical notifications invisible). `set` runs `makoctl mode -a|-r` only
  while this user's mako owns `org.freedesktop.Notifications` (a `makoctl`
  call before would have D-Bus start a plain mako); `flickos-control
  notifications` (autostart) waits for mako and adds the mode again when it
  is on. A user's own mako config without the mode is named on the page.
- **Startup applications** (`flickos-control startup
  list|enable|disable|add|remove|run`): the XDG autostart entries labwc
  doesn't run, by the spec (`~/.config/autostart` first, then `autostart` in
  `XDG_CONFIG_DIRS`; `Hidden`, `OnlyShowIn`/`NotShowIn`, `TryExec`, `Exec`
  field codes, `Terminal`, `Path`, `X-GNOME-Autostart-Delay`). Off is
  `X-GNOME-Autostart-enabled=false`, for a system entry in a user copy;
  `add` copies an installed app's desktop file, `remove` deletes the user's
  own. `run` (autostart, last) waits at most 10 s for the tray, then starts
  the entries that are on.
- **Automatic updates** are read from `apt-config dump`
  (`flickos-control updates` prints them): on or off
  (`APT::Periodic::Unattended-Upgrade`), the scope (the
  `Unattended-Upgrade::Origins-Pattern` list: `security`, `debian` =
  Debian's own, `all` = also `trixie-updates` and FlickOS, else `custom`),
  restarting (`no`, `idle` = when nobody is logged in, `always`), and the last
  run (the stamp file's time).
- **Kept screen arrangements** (`flickos-control displays
  list|save|forget NAME|all|start`): `save` writes a kanshi profile for the
  screens connected now (from `wlr-randr --json`) into
  `~/.config/flickos/displays`, one per set of screens, named after them so
  keeping them again replaces it. `start` (autostart) execs `kanshi -c` that
  file with `FLICKOS_DISPLAYS=1`, only while a profile is kept and no other
  kanshi runs; `save` and `forget` make it reread (SIGHUP), start it or stop
  it. kanshi applies the profile of the connected screens at login and on
  every plug or unplug.
- **The system keyboard layout** (login screen, console, new accounts) is
  `/etc/default/keyboard`. Debian's systemd forbids changing it through
  `localectl`, so the Keyboard page runs `pkexec
  /usr/libexec/flickos/control-helper keyboard MODEL LAYOUT VARIANT OPTIONS`:
  polkit action `org.flickos.control.keyboard`
  (`usr/share/polkit-1/actions/org.flickos.control.policy`, one action per verb
  via `exec.argv1`, admin password). The helper checks every value against
  xkb-data's `evdev.lst`, rewrites only the `XKB*` lines, runs `udevadm trigger`
  and `setupcon --save-only -k`. The same helper has `autologin-on` and
  `autologin-off` (actions `org.flickos.control.autologin-on`/`-off`): for
  the user who ran pkexec (`PKEXEC_UID`, a regular account) only, it makes
  them the only member of group `autologin` (`gpasswd -M`), or takes them out.
- **User accounts** go through the same helper, one action each
  (`org.flickos.control.user-add`, `-remove`, `-admin`, `-password`):
  `user-add NAME FULLNAME yes|no` runs `adduser --disabled-password` (so
  `/etc/skel`, and with it the first-login markers, is copied), sets the
  password it reads on standard input with `chpasswd` and adds the installer's
  groups for the first account (`DEFAULT_GROUPS`, flickos-installer's
  `users.conf` without `sudo`; a test compares them), plus `sudo` for an
  administrator; if a step fails, the account is removed again. `user-remove
  NAME keep|delete` runs `userdel [--remove]`, not for the calling user and not
  while the account has processes running. `user-admin NAME yes|no` changes
  membership in `sudo` (polkit's and sudo's administrators on Debian).
  `user-password NAME` reads the password on standard input. Only regular
  accounts (`UID_MIN`..`UID_MAX` of `/etc/login.defs`), names that match
  adduser's `NAME_REGEX`, and never away from the last administrator.
- **The firewall** goes through the same helper: `firewall-on` runs `ufw
  --force enable` (no question about ssh connections), `firewall-off` runs
  `ufw disable` (actions `org.flickos.control.firewall-on`/`-off`). The page
  reads `ENABLED=` from `/etc/ufw/ufw.conf`, which everyone can read, because
  `ufw status` needs root. Rules stay a job for `sudo ufw` in a terminal. ufw
  is a Recommends of flickos-desktop, not a dependency of this package: without
  it the page is left out.
- **The power button and the lid** go through the same helper: `power
  power-key|lid|lid-external-power poweroff|suspend|lock|ignore|default`
  rewrites `/etc/systemd/logind.conf.d/60-flickos.conf` and runs `systemctl
  reload systemd-logind` (action `org.flickos.control.power`). **Adding a
  language:** `locale-add LOCALE` (a UTF-8 locale of
  `/usr/share/i18n/SUPPORTED`) turns its `/etc/locale.gen` line on and runs
  `locale-gen --keep-existing` (action `org.flickos.control.locale-add`).
  **Automatic updates:** `updates auto yes|no`, `scope
  security|debian|all`, `reboot no|idle` (each also `default`) keeps the
  choices in `/etc/apt/apt.conf.d/60flickos-updates` (after Debian's files;
  `#clear` replaces the origins; action `org.flickos.control.updates`).
- **For the other settings it owns nothing.** Each page runs the command that owns the setting,
  the same one a user could type: `flickos-layout state|set`, `style set`,
  `clicks set`, … and `doctor` (its warnings are shown on the page),
  `flick-tiler status|modes|on|off|mode|ratio|gap|floating`, `flickos-shortcuts
  list|show`. Pages read when they are shown (Super+T, the panel or the chooser
  may have changed something), in a background thread with a spinner until the
  answer is there, so the window opens at once. Changes run in the background
  too (`Gio.Subprocess`), and the page shows what the command printed.
- **History** (*History* page, `flickos-control history [--days N] [--json]`,
  `history undo ID`, `history clear`): every program that owns settings
  (this one, flickos-layout, flick-tiler) appends one JSON line per change
  that shows to `~/.local/state/flickos/history.jsonl` (0600; the older half is
  dropped above 256 KiB), with its own `record()` in the same format. The page
  shows the last 90 days, one framed list per day, at most 100 rows. Changes
  of one setting less than two minutes apart are one, and one that ends where
  it started is left out. **Undo** runs the owner's command with the old
  value (`flickos-control set KEY OLD`, `flickos-layout set OLD`, `flick-tiler
  on|off|mode|ratio|gap|floating`, where `default` removes the user's value),
  only for the setting's newest change and only while the setting still holds
  its new value. The file holds values, never commands. `history.enabled` (on
  by default; conffile `/etc/xdg/flickos/history.conf`, which the other
  owners read too) turns recording off and deletes the file. Design:
  [design/flickos-history.md](https://github.com/dvbondoy/FlickOS/blob/main/docs/design/flickos-history.md).
  - **System settings** (power button and lid, firewall, automatic login,
    automatic updates, time zone, network time, the login screen's keyboard
    layout) change through `flickos-control system KEY [VALUE]`, which the
    pages run: it reads the value, runs the helper or `timedatectl`, and
    records the change once it worked; undo runs it with the old value.
    Default applications go through `flickos-control default-app list|set
    CATEGORY APP`, startup applications through `startup`, and the Users and
    Language pages record added and removed accounts, administrator on or off
    (the only one of these with Undo) and added languages.
  - **Software** comes from apt's own log, read by the helper without root
    (`control-helper packages-list [DAYS]`): installs, removals and updates,
    leaving out the installation (up to the installer's removal of itself; in
    the live session, the image's build). An install or removal has *Undo*:
    `packages-plan ID` (no root) says what it would do, the page shows that
    first, and `pkexec control-helper packages-undo ID` (action
    `org.flickos.control.packages-undo`) checks it again with `apt-get -s` and
    refuses an undo that would remove anything else, anything flickos-desktop
    depends on, or install a live-session package. Updates, autoremoves and
    transactions that both installed and removed are shown without Undo.
  - **Put back as it was** (*Put Back as It Was…*, `flickos-control history
    restore WHEN [--dry-run]`): every setting changed since WHEN that needs
    no password (FlickOS's own settings, layout, tiling, default and startup
    applications) gets its value then, flickos-layout's in one `set`. The
    dialog shows what goes back per day first. The restore is one row in the
    list, and its Undo puts back what it changed. System settings and
    software keep their own Undo.
- **Commands:** `flickos-control [--page ID]` opens the window (one per
  session: `$XDG_RUNTIME_DIR/flickos/control.lock`), `flickos-control list`
  prints the page ids, `flickos-control about` prints the system information
  (the text *Copy System Info* copies), `flickos-control system KEY [VALUE]`
  and `default-app list|set` print and change system settings and default
  applications.
- **Depends on** flickos-layouts (>= 1.22: 1.13 merges its fragment and
  writes the environment overlay, 1.19 has `state`, 1.22 records its changes
  and takes `default`), flick-tiler (>= 1.5, for `floating`, `gap`, the width
  in `status`, recording and `default`), flickos-shortcuts, `pkexec` and `xkb-data` for
  the helper, `xdg-utils` for default apps, and `kanshi` and `wlr-randr` for
  kept screen arrangements.
- **A Depends of `flickos-desktop`** and in the sanity hook's `REQUIRED`.
- **Unit tests** in `tests/` (reading the commands' output, tiles, the command
  line, the lock, the settings and fragments against labwc 0.8.3's key list,
  the helper), run at package build. The boot test opens the window on each
  page and saves screenshots (`boot-test/control-*.png`), applies a
  touchpad option, a layout and the formats live, keeps and forgets a
  screen arrangement (kanshi started and stopped), and records a clock change
  and undoes it through `history`.

### `flickos-greeter`

The login screen of installed systems: greetd runs gtkgreet in the cage kiosk
compositor, in the Arc-Dark colors. Nothing replaces greetd's own
`/etc/greetd/config.toml` (it is ignored):

- `usr/lib/systemd/system/greetd.service.d/flickos.conf`: a drop-in that
  skips greetd with `boot=live` (the live session keeps its tty1 autologin),
  runs `greetd-config` before each start and points greetd at its output.
- `usr/libexec/flickos/greetd-config`: writes
  `/run/flickos-greetd/config.toml`: VT 7, the greeter as `_greetd`, and an
  `initial_session` (automatic login, once per boot) for the first member of
  the group `autologin`.
- `usr/libexec/flickos/greeter`: sets the keyboard layout from
  `/etc/default/keyboard` and `GTK_THEME=Arc-Dark`, then runs
  `cage -d -s -- gtkgreet --command flickos-session --style …`.
- `usr/share/flickos/greeter/gtkgreet.css`: wallpaper (flickos-settings'
  `default.jpg`) and login box. Checked by `tools/check-palette.py`.
- `debian/flickos-greeter.sysusers`: creates the group `autologin`
  (`dh-sequence-installsysusers` adds the `systemd-sysusers` call to the
  postinst).

greetd's postinst enables it as `display-manager.service` but doesn't start
it, so an upgraded system switches to the login screen at the next boot.
**A Depends of `flickos-desktop`** and in the sanity hook's `REQUIRED`. See
[09 – Login screen](/docs/09-customizing/#login-screen).

### `flickos-installer`

Calamares configuration and FlickOS branding, the `flickos-install` launcher,
and the live-session menu with *Install FlickOS*. It replaces Debian's
`calamares-settings-debian` and is only in the live image
(`config/package-lists/installer.list.chroot`): Calamares removes it from
installed systems. See [09 – Installer](/docs/09-customizing/#installer).

### `flickos-branding`

The Plymouth boot splash theme (`usr/share/plymouth/themes/flickos/`), and the
FlickOS name in `/etc/os-release`, `/etc/issue` and `/etc/issue.net`. Those three
files belong to Debian's `base-files`, so the package **diverts** Debian's
versions (`dpkg-divert`) and generates FlickOS versions from them in
`debian/flickos-branding.postinst`. File triggers regenerate them whenever
`base-files` is upgraded. `usr/lib/flickos-release` holds the FlickOS name and
version. This is the only FlickOS package with hand-written maintainer scripts
(`postinst`, `postrm`, `triggers`); flickos-greeter's postinst is only
debhelper's generated sysusers snippet. See [09 – OS name and login banner](/docs/09-customizing/#os-name-and-login-banner).

### `flickos-archive-keyring`

Installs the FlickOS apt repository's public key to
`/usr/share/keyrings/flickos-archive-keyring.asc`. The source file is
`packages/flickos-archive-keyring/keyrings/flickos-archive-keyring.asc`,
created by `repo/new-key.sh` (see [05 – Apt repository](/docs/05-apt-repository/)).
It must be committed to git. It's the *public* key and safe to publish.

## Anatomy of a package

```
packages/flickos-settings/
├── etc/…                     files to install (any layout you like)
└── debian/
    ├── control               name, dependencies, description
    ├── changelog             version history. The top entry IS the version
    ├── copyright             who owns which files, under which license
    ├── install               "source-path   destination-dir/" lines
    ├── rules                 build script. `dh $@` handles everything
    └── source/format         "3.0 (native)"
```

| File | Notes |
|---|---|
| `control` | First stanza = source package, then one stanza per binary package. Lines starting with `#` are comments. Use `Architecture: all` for anything without compiled code. `${misc:Depends}` must stay |
| `changelog` | Strict format, so edit with `dch`, not by hand. The version and distribution come from the top entry |
| `copyright` | [DEP-5](https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/) format, installed as `/usr/share/doc/PACKAGE/copyright`. `Files: *` is FlickOS's own work, GPL-3+ (the project license, `LICENSE`). Every file that came from elsewhere (a photo, a config copied from a Debian package) gets its own `Files:` stanza with its authors and license, after `Files: *` (the last match wins). Update it when you add such a file |
| `install` | Paths are relative to the package root. Destination is a directory |
| `rules` | Must be executable (`chmod +x`). `dh $@` runs the standard debhelper sequence |
| `source/format` | `3.0 (native)` for all FlickOS packages |
| `PACKAGE.postinst`, `.postrm`, `.triggers` (optional) | Maintainer scripts run by dpkg on install/remove, and trigger declarations. `#DEBHELPER#` marks where debhelper inserts generated code. Must be executable. Example: `flickos-branding` |

## Building

```sh
sh packages/build.sh
```

This builds **every** folder in `packages/` that has a `debian/` directory, and
puts the `.deb` files in `config/packages.chroot/`. It stops with an error if
the repository public key doesn't exist yet.

To build or inspect a single package by hand:

```sh
cd packages/flickos-settings
dpkg-buildpackage -us -uc -b        # .deb appears in packages/
dpkg-deb -c ../flickos-settings_1.0_all.deb    # list files inside
dpkg-deb -I ../flickos-settings_1.0_all.deb    # show control info
```

`build.sh` builds in a copy (`packages/.build/`) to keep build leftovers out of
the source tree. If you build by hand, clean up afterwards: `debian/.debhelper/`,
`debian/files`, `debian/flickos-settings/`, `debian/*.substvars` and the
`../*.deb`, `../*.buildinfo`, `../*.changes` files.

To test a package on a running FlickOS or Debian system without rebuilding the ISO:

```sh
sudo apt install ./config/packages.chroot/flickos-settings_1.1_all.deb
```

## Changing a package

Example: add a keybinding to `rc.xml`.

1. **Edit the file:** `packages/flickos-settings/etc/xdg/labwc/rc.xml`.
2. **Bump the version** with a changelog entry:
   ```sh
   export DEBFULLNAME="Jon" DEBEMAIL="dvbondoy@gmail.com"   # put these in ~/.bashrc or ~/.zshrc
   cd packages/flickos-settings
   dch -i -D trixie "Add Super+L to lock the screen."
   ```
   `dch -i` goes from `1.0` to `1.1`, and `-D trixie` sets the distribution.
   Without `-D`, dch writes `UNRELEASED`. Check the top of `debian/changelog`.
3. **Build and test:** `sh packages/build.sh`, then install the `.deb` in a VM or rebuild the ISO.
4. **Commit** the file change and the changelog together.
5. **Publish** so installed systems receive it: `repo/publish.sh` and upload.
   See [05 – Apt repository](/docs/05-apt-repository/).

**Always bump the version when contents change.** apt only upgrades to a
*higher* version, and reprepro refuses a different file with a version it
already has.

### Version numbers

Keep it simple: `1.0`, `1.1`, `1.2`, … `2.0`. Native packages must **not** use
a `-1` suffix. Compare two versions with:

```sh
dpkg --compare-versions 1.10 gt 1.9 && echo yes    # yes: dpkg compares numerically
```

## Adding or removing a desktop package

Edit `packages/flickos-desktop/debian/control`, add the package under
`Depends:` or `Recommends:` (comma-separated, one per line, indented), then
bump the version with `dch -i -D trixie "Add firefox-esr."`.

Check that the name exists in trixie first: `apt policy firefox-esr` on a trixie
machine, or search at https://packages.debian.org/trixie/.

**Removing** a package from `flickos-desktop` does **not** remove it from
systems that already have it installed. It only stops new installs from
getting it. To really remove something from existing installs, add
`Conflicts:`/`Breaks:` (use with care) or document it in release notes.

## Creating a new package

Example: `flickos-wallpapers`.

```sh
cp -r packages/flickos-archive-keyring packages/flickos-wallpapers
cd packages/flickos-wallpapers
rm -rf keyrings debian/changelog
mkdir -p usr/share/backgrounds/flickos-extra
cp ~/Pictures/beach.jpg ~/Pictures/forest.jpg usr/share/backgrounds/flickos-extra/
```

(An extra wallpaper collection. The default wallpaper itself lives in
`flickos-settings`, see [09](/docs/09-customizing/#wallpaper). Using a separate
directory guarantees the two packages never ship the same file.)

Then:

1. `debian/control`: change `Source:` and `Package:` to `flickos-wallpapers`,
   update `Depends:` and `Description:`. The description's first line is a short
   summary. Following lines start with one space, and blank lines are ` .`.
2. `debian/install`: `usr/share/backgrounds/flickos-extra/*   usr/share/backgrounds/flickos-extra/`
3. `debian/copyright`: change `Upstream-Name:`, and add a stanza for the
   photos, since they aren't FlickOS's own work (see `flickos-layouts`' for
   Unsplash photos).
4. `debian/changelog`: `dch --create --package flickos-wallpapers -v 1.0 -D trixie "Initial release."`
5. Build: `sh packages/build.sh`.
6. Make something pull it in, e.g. add `flickos-wallpapers` to
   `flickos-desktop`'s `Depends:` (or `Recommends:`) and bump that package's version too.
7. Publish both. See [05](/docs/05-apt-repository/).

## Checking quality with lintian (optional)

`lintian` reports packaging mistakes:

```sh
sudo apt install lintian
lintian config/packages.chroot/flickos-settings_*.deb
```

Warnings like `no-manual-page` are expected for small distro packages. Errors (`E:`) are worth fixing.
