---
title: Customizing
description: "How FlickOS is put together, and step-by-step recipes for changing it: wallpaper, default apps, menus, keybindings, program defaults, installer, boot menu,…"
sidebar:
  order: 9
---
How FlickOS is put together, and step-by-step recipes for changing it:
wallpaper, default apps, menus, keybindings, program defaults, installer, boot
menu, boot splash, OS name and firewall.

- [Before you start](#before-you-start)
- [How FlickOS config directories work](#how-flickos-config-directories-work)
- [Session startup](#session-startup)
- [Login screen](#login-screen)
- [Desktop layouts](#desktop-layouts)
- [Window tiling](#window-tiling)
- [Wallpaper](#wallpaper)
- [Default apps](#default-apps)
- [Settings window](#settings-window)
- [Menu entries](#menu-entries)
- [Keybindings](#keybindings)
- [Program defaults](#program-defaults)
- [Installer](#installer)
- [Boot menu](#boot-menu)
- [Boot splash](#boot-splash)
- [OS name and login banner](#os-name-and-login-banner)
- [Firewall](#firewall)
- [Artwork](#artwork)
- [Ideas for later](#ideas-for-later)

## Before you start

### Where customizations live

| Package | Contains |
|---|---|
| `flickos-settings` | Desktop configuration: session script, labwc config, startup programs, program defaults, wallpaper, GTK theme defaults |
| `flickos-layouts` | Desktop layouts and the `flickos-layout` tool ([Desktop layouts](#desktop-layouts)) |
| `flickos-desktop` | Which apps and services are installed ([04](/docs/04-packages/#flickos-desktop-meta-package)) |
| `flickos-greeter` | Login screen of installed systems ([Login screen](#login-screen)) |
| `flickos-installer` | Calamares configuration, branding, launcher, live-session menu ([Installer](#installer)) |
| `flickos-branding` | Boot splash, OS name in `/etc/os-release`, console login banner |
| `config/bootloaders/` (not a package) | ISO boot menu ([Boot menu](#boot-menu)) |
| `config/hooks/normal/0200-firewall.hook.chroot` (not a package) | Turns the firewall on in the ISO ([Firewall](#firewall)) |

The rule for deciding between a package and live-build config is in
[03](/docs/03-live-build-config/#rule-of-thumb-package-or-live-build-config).

### Three rules

1. **Never install a file another package already owns.** dpkg refuses to
   install the package (`trying to overwrite '…', which is also in package …`).
   Before adding a file under `/etc` or `/usr`, check on a trixie system:
   ```sh
   dpkg -S /etc/xdg/foot/foot.ini          # installed packages
   apt-file search /etc/xdg/foot/foot.ini  # all packages (sudo apt install apt-file && sudo apt-file update)
   ```
   Debian's foot, fuzzel, waybar, pcmanfm and libfm **already ship** their
   default configs in `/etc/xdg`. That's why FlickOS uses its
   [own config directories](#how-flickos-config-directories-work).
2. **Users' own config always wins.** Programs read `~/.config/…` first. You're
   setting *defaults*, and a user who customizes a program stops receiving your
   changes for that file ([04](/docs/04-packages/#flickos-settings)).
3. **Every change ships the same way:** edit → bump version → build → test → publish.

### Shipping a change

```sh
cd packages/flickos-settings
dch -i -D trixie "Describe the change."          # bump version (04)
cd ../..
# new top-level folder in the package? add it to debian/install
tools/build-iso.sh && tools/boot-test.py          # build + automated test (02)
tools/test-iso.sh                                 # look at it (02)
repo/publish.sh                                   # ship to installed systems (05), then upload
```

**Faster loop for config-only changes:** build just the packages
(`sh packages/build.sh`) and boot an existing ISO or test install with
`tools/test-iso.sh`. On the host, run `python3 -m http.server` in
`config/packages.chroot/`. Inside the VM, download the new `.deb` from
`http://10.0.2.2:8000/` and install it with `sudo apt install ./flickos-settings_*.deb`.
Then log out (`Super+Shift+E`) and log in again.

**Even faster, for experiments:** edit the files directly inside a running VM
(`sudo nano /etc/xdg/labwc/rc.xml`), then choose *Settings → Reload Desktop
Config* in the menu (labwc config) or log out and in (everything else). Copy the
result back into `packages/` when it works.

Details: [04 – Changing a package](/docs/04-packages/#changing-a-package),
[02 – Building and testing](/docs/02-building-and-testing/),
[05 – Publishing packages](/docs/05-apt-repository/#publishing-packages).

---

## How FlickOS config directories work

FlickOS ships program defaults in its own directories and puts them **first**
in the XDG search paths. That avoids clashing with files Debian's packages own.

| Directory | Holds | Takes priority over |
|---|---|---|
| `$XDG_RUNTIME_DIR/flickos/xdg/` | Runtime overlay: files generated for the chosen [desktop layout](#desktop-layouts) and [style](#styles-darklight) at every login (`labwc/rc.xml`, `foot/foot.ini`, `fuzzel/fuzzel.ini`). RAM only, never edited by hand | Everything below |
| `/etc/xdg/flickos-live/` | Live-session-only config (from `flickos-installer`) | Everything below |
| `/etc/xdg/flickos/` | Program config: `foot/foot.ini`, `fuzzel/fuzzel.ini`, `mimeapps.list` | `/etc/xdg/…` from Debian packages |
| `/usr/share/flickos/` | Data: `waybar/`, `mako/`. `applications/` overrides can go here too | `/usr/share/…` |

The session script `packages/flickos-settings/usr/bin/flickos-session` sets
this up at every login, just before `exec labwc`:

```sh
XDG_CONFIG_DIRS="/etc/xdg/flickos:${XDG_CONFIG_DIRS:-/etc/xdg}"
XDG_DATA_DIRS="/usr/share/flickos:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
[ -d /etc/xdg/flickos-live ] && XDG_CONFIG_DIRS="/etc/xdg/flickos-live:$XDG_CONFIG_DIRS"
timeout 10 flickos-layout prepare && XDG_CONFIG_DIRS="$XDG_RUNTIME_DIR/flickos/xdg:$XDG_CONFIG_DIRS"
```

(Simplified: the real script only runs `flickos-layout` if it's installed and
`XDG_RUNTIME_DIR` is set.) The overlay folder is added even when it's empty, so
a later `flickos-layout set` can put files there without a new login.

Programs following the XDG spec look in `~/.config` first, then each directory
in `XDG_CONFIG_DIRS` in order, and use the **first** file they find.

The variables are set in the session script, not in labwc's `environment`
file, because labwc only reads the first `environment` file it finds. A user's
`~/.config/labwc/environment` would silently drop them.

The boot test checks that the live labwc session got the right `XDG_CONFIG_DIRS`
(check *session uses FlickOS config dirs*).

---

## Session startup

What happens after login. The [login screen](#login-screen) runs
`flickos-session` directly. A login on tty1 (the live session's autologin, or
the text login) reads `/etc/profile.d/95-flickos-session.sh`, which runs it
on tty1 only.

1. `flickos-session` sets the config directories, runs
   `flickos-layout prepare` ([Desktop layouts](#desktop-layouts)), sets the
   keyboard layout ([below](#keyboard-layout)), then runs `exec labwc`.
2. labwc reads `/etc/xdg/labwc/rc.xml`, `menu.xml` and `environment`, then runs
   `/etc/xdg/labwc/autostart`.
3. That file only calls **`/usr/libexec/flickos/autostart`**, which starts everything:

| Program | Purpose | Notes |
|---|---|---|
| `xdg-user-dirs-update` | Creates `~/Desktop`, `~/Pictures`, … | Screenshots go to `~/Pictures/Screenshots` |
| `swaybg` | Wallpaper | Started by `flickos-layout wallpaper`: the user's choice or the layout's wallpaper ([Wallpaper](#wallpaper)). Without flickos-layouts, autostart starts swaybg directly |
| `mako` | Notifications | Started by `flickos-layout panel` with a config generated for the chosen style, unless the user has their own ([mako](#mako-notifications)) |
| `waybar` | Panel | Started by `flickos-layout panel` with the chosen layout's config and style's colors, unless the user has their own ([waybar](#waybar-panel)). Without flickos-layouts, autostart starts the default panel and mako directly |
| `polkit-mate-authentication-agent-1` | Password prompts for admin actions | |
| `nm-applet --indicator` | Network tray icon | `--indicator` is required: waybar's tray only shows StatusNotifierItem icons |
| `blueman-applet` | Bluetooth tray icon | Only if installed **and** a Bluetooth adapter exists (`/sys/class/bluetooth` not empty). It's a Python process, so it isn't started needlessly. A USB adapter plugged in later appears after the next login |
| `wl-paste --watch cliphist store` | Clipboard history (`Super+V`) | Only if installed |
| `/usr/libexec/flickos/night-light` | Warmer screen colors at night | Runs `wlsunset` with the coordinates of the system time zone's city (from tzdata's `zone1970.tab`, offline). No time zone set (e.g. UTC in the live session) → fixed times 18:30–06:30 |
| `flickos-shortcuts daemon` | Keyboard shortcut sheet while Super is held | Only if installed ([Shortcut sheet](#shortcut-sheet-hold-super)) |
| `flickos-layout first-run` | Desktop Layout & Style chooser at the first login of a new account | Only if flickos-layouts is installed; never in the live session ([First login](#first-login)) |
| `flickos-control idle` (swayidle) | Lock and suspend after the times in *Settings → Power & Idle* (default 5 and 15 min); a fixed swayidle without flickos-control | **Not in the live session**, so installs are never interrupted |
| `flickos-control startup run` | The XDG autostart entries (*Settings → Startup Applications*): `~/.config/autostart`, then `/etc/xdg/flickos/autostart` and `/etc/xdg/autostart` | Last. Waits up to 10 s for the tray |

**To add a startup program**, add a line to
`packages/flickos-settings/usr/libexec/flickos/autostart`. End it with `&`
unless it exits immediately. Use `if command -v PROGRAM >/dev/null; then … fi`
for anything in `Recommends:`, which users may uninstall. If the program's
package also installs an entry in `/etc/xdg/autostart`, hide it with a file of
the same name and `Hidden=true` in
`packages/flickos-settings/etc/xdg/flickos/autostart/`, or it starts twice. A
program users may choose to run (a tray applet) can instead stay an XDG
autostart entry; an override there with `X-GNOME-Autostart-enabled=false`
makes it off by default and switchable in Settings.

**Why a separate script:** labwc only reads the first `autostart` it finds. A
user who creates `~/.config/labwc/autostart` would lose the whole FlickOS
desktop (panel, tray, polkit agent), unless their file calls the script:

```sh
/usr/libexec/flickos/autostart
my-own-program &
```

Tell users this in your release notes or user docs.

---

## Login screen

Installed systems boot to a graphical login screen (`packages/flickos-greeter/`):
**greetd** is the display manager, and its greeter is **gtkgreet** running in
the **cage** kiosk compositor. After a successful login gtkgreet asks greetd to
start `flickos-session`. The live session doesn't use it: it logs in
automatically on tty1 (live-config), and the drop-in skips greetd with
`boot=live`.

| File | Purpose |
|---|---|
| `usr/lib/systemd/system/greetd.service.d/flickos.conf` | Drop-in: `ConditionKernelCommandLine=!boot=live`, runs `greetd-config` before each start, `greetd --config /run/flickos-greetd/config.toml` |
| `usr/libexec/flickos/greetd-config` | Writes that config: `vt = 7`, the greeter as `_greetd`, and the automatic login |
| `usr/libexec/flickos/greeter` | Keyboard layout from `/etc/default/keyboard`, `GTK_THEME=Arc-Dark`, `exec cage -d -s -- gtkgreet …` |
| `usr/share/flickos/greeter/gtkgreet.css` | Wallpaper and login box (Arc-Dark palette) |

greetd's own `/etc/greetd/config.toml` is ignored. Calamares doesn't run its
`displaymanager` module, which would rewrite that file for its own setup.

- **VT 7:** the login screen runs on VT 7 (Debian's greetd default). tty1
  keeps its text login as a fallback (Ctrl+Alt+F1), which starts the same
  session through the profile.d script. greetd sources `/etc/profile` for its
  sessions too, but the script only acts on tty1.
- **Automatic login:** `greetd-config` logs in the first member of the group
  `autologin` once per boot (greetd's `initial_session`). The installer's *Log
  in automatically* adds the user to that group (`autologinGroup` in
  `users.conf`); the package creates it (`debian/flickos-greeter.sysusers`).
  On a running system: `sudo gpasswd -a USER autologin` (or `-d` to stop).
  It applies at the next boot.
- **Look:** gtkgreet's widgets come from the Arc-Dark GTK theme. The CSS sets
  the wallpaper (`background-size: cover`; gtkgreet's own `--background`
  draws the image unscaled) and styles `#body` (the login box) and `#clock`.
  gtkgreet has no shutdown or restart buttons.
- **Back to the text login:** `sudo systemctl disable greetd` (the tty1 login
  starts FlickOS as before). `enable` brings the login screen back.
- **Test:** `tools/test-iso.sh --install`, then boot the disk
  (`tools/test-iso.sh --disk`). The boot test only checks that greetd is
  enabled and not running in the live session.

---

## Desktop layouts

A **desktop layout** decides how the panel is arranged, the wallpaper and,
optionally, the order of the window title bar buttons. Layouts come from the
`flickos-layouts` package. The same chooser also sets the
[style](#styles-darklight) and the [desktop clicks](#desktop-clicks). Users switch at any time with *Settings → Desktop Layout & Style*
(the [chooser](#the-chooser)) or `flickos-layout set ID`. Both apply right away, and
the choice is remembered.

| Id | Name | Bars | Window buttons |
|---|---|---|---|
| `redmond` (**default**) | Redmond | One bottom panel: logo launcher button, window list with icons and titles, then tray (network is nm-applet's icon there), volume and battery icons and a two-line clock | Right (labwc default) |
| `cupertino` | Cupertino | Thin top bar (logo launcher button, clock, tray and status) and a centered dock at the bottom that fits its icons ([sfwbar](/docs/04-packages/#sfwbar)). The dock takes no screen space. It is shown unless the active window is maximized (or fullscreen) on its monitor; then it hides until the pointer touches the bottom edge below it. It shows pinned apps, then other open apps. A line under an icon marks an open app, in the accent color for the active one. Hovering an app with several windows lists them | Left: `close,iconify,max:` |
| `traditional` | Traditional | Top panel (logo and *Applications* launcher button, clock, tray and status) and a bottom window list with titles | Right (labwc default) |

The launcher opens fuzzel. All bars of a layout run in **one** waybar process,
so there is always exactly one tray. A layout's dock (`Dock=`, only Cupertino)
is a separate sfwbar process without a tray.

**Limits** (tell users in release notes):

- No workspace switcher: waybar has no labwc workspace module.
- The dock has no magnification or drag-to-pin. Pinned apps are set in
  `layout.ini`.
- The hidden dock reappears only when the pointer touches the bottom edge
  right below it: the strip that reacts is as wide as the dock.
- The dock only knows whether the active window is maximized, not where windows
  are (labwc doesn't tell other programs). So it stays shown over the bottom of
  a normal window moved down to it, and over a maximized window that isn't the
  active one.
- No global menu bar in Cupertino.

### Files

| File in `packages/flickos-layouts/` | Purpose |
|---|---|
| `usr/bin/flickos-layout` | The tool: one Python 3 file, standard library only |
| `usr/share/flickos/layouts/ID/layout.ini` | One folder per layout. The folder name is the id (`a-z`, `0-9`, `-`, `_`) |
| `usr/share/flickos/layouts/ID/waybar.jsonc`, `style.css` | The layout's bars and CSS |
| `usr/share/flickos/layouts/cupertino/dock.config`, `dock.css` | Cupertino's dock: sfwbar config (see `sfwbar(1)`) and its CSS |
| `usr/share/flickos/layouts/ID/preview.png` | 240×150 image shown in the chooser (`tools/make-layout-previews.sh`) |
| `usr/share/flickos/layouts/ID/wallpaper.jpg` | The layout's [wallpaper](#wallpaper), up to 3840 px wide |
| `debian/links` | Links each layout's wallpaper to `/usr/share/backgrounds/flickos/ID.jpg`, where waypaper shows it |
| `usr/share/applications/flickos-layout.desktop` | *Desktop Layout & Style* in the app launcher (Settings category) |
| `etc/skel/.config/flickos/choose-layout` | Marker copied into new accounts: the chooser opens at their [first login](#first-login) |
| `usr/share/flickos/layouts/common/modules.jsonc` | Module settings shared by all layouts: launcher, taskbar, clock, volume, battery, tray |
| `usr/share/flickos/layouts/common/base.css` | CSS shared by all layouts (fonts, translucent bars, module padding, volume and battery icons, tooltips) |
| `usr/share/flickos/styles/ID/waybar-colors.css` | The panel palette of each [style](#styles-darklight): `@define-color` with Arc-Dark or Arc values. The only CSS files with color values |
| `etc/xdg/flickos/layouts.conf` | `[Defaults] Layout=`, `Style=`, `Clicks=`, `Launcher=` and `MenuStyle=`: defaults for users who haven't chosen (conffile) |
| `tests/test_engine.py`, `tests/fixtures/rc.xml` | Unit tests for the engine |
| `tests/test_layouts.py` | Unit tests for the shipped layouts and panel generation (see [Adding a layout](#adding-a-layout)) |
| `tests/test_chooser.py` | Unit tests for `pick` (lock, fuzzel fallback, which command a selection runs), `first-run`, previews, the desktop file and the marker. GTK itself isn't started |
| `tests/test_styles.py` | Unit tests for styles: overlay files, GTK settings, commands and the shipped palettes |

The tests run while the package builds (`override_dh_auto_test` in `debian/rules`).

`layout.ini` (Cupertino):

```ini
[Layout]
Name=Cupertino
Comment=Top bar with status icons and a dock at the bottom; window buttons on the left
Order=20
Waybar=waybar.jsonc
Style=style.css
Preview=preview.png
Wallpaper=wallpaper.jpg
Menu=top-left
MenuStyle=grid
TitlebarLayout=close,iconify,max:
Dock=dock.config
DockStyle=dock.css
Pinned=firefox-esr.desktop;pcmanfm.desktop;foot.desktop;libreoffice-writer.desktop;vlc.desktop;org.xfce.mousepad.desktop
```

`Order` sorts `list`. `Waybar` and `Style` are paths relative to the layout's
folder, or absolute. `TitlebarLayout` is optional and sets labwc's
`<theme><titlebar><layout>`. Comments go on their own lines (`#`): a `#` after
a value is part of the value. `TitlebarLayout` is `left:right`, with the buttons `icon`, `menu`, `iconify`,
`max`, `close`, `shade` and `desk`. An invalid value is ignored with a warning.
`set` also gives the layout's buttons to windows that draw their own title bar
([GTK settings](#gtk-settings-and-nwg-look)).
A layout with a missing `Name`, `Waybar` or `Style` isn't listed.

`Preview` (optional) is an image for the chooser, scaled to fit 240×150. A
layout without one gets an empty space.

`Wallpaper` (optional) is shown with `swaybg -m fill` while the layout is in
use, unless the user chose their own ([Wallpaper](#wallpaper)). A layout
without one shows flickos-settings' `default.jpg`. Add a line for it to
`debian/links` so waypaper lists it (`tests/test_layouts.py` checks this).

`Menu` (optional) is `bottom-left` or `top-left`: where the [start
menu](#start-menu) opens, in the corner of the bar with the apps button. A
layout without it keeps fuzzel even while the start menu is on. `MenuStyle`
(optional) is its kind of menu: `classic` (default), `categories` or `grid`.
`tests/test_layouts.py` checks that the corner matches the bar's position.

`Pinned` (optional) lists desktop file ids separated by `;`. They are shown
where a bar in `waybar.jsonc` has the module name **`flickos/pinned`**, and in
the dock where its config has the line **`pins = "flickos/pinned"`**.

`Dock` and `DockStyle` (optional, both or neither) are a dock run by
[sfwbar](/docs/04-packages/#sfwbar): an sfwbar config without a `#CSS` section
(syntax `#Api2`, see `sfwbar(1)`), and its CSS. The CSS follows the same rule as
`style.css`: palette color names only. sfwbar's names are `window#sfwbar` (the
dock's window), `grid#STYLE` (the taskbar with `style = "STYLE"`),
`button#taskbar_popup` (an app, with the classes `focused` and `running`) and
`window#taskbar_popup` (the list of an app's windows).

### The generated panel

`flickos-layout panel` (and `set`) never run a layout's files directly. They
generate two files in `$XDG_RUNTIME_DIR/flickos/waybar/` and start
`waybar -c config.jsonc -s style.css` with them:

- **`config.jsonc`:** the layout's `waybar.jsonc` (one bar object or a list of
  bars) with relative `include` paths made absolute, and `flickos/pinned`
  replaced by one `custom/pin#app-ID` module per pinned app. Each has a tooltip
  with the app's `Name` and runs `gio launch FILE.desktop` on click.
- **`style.css`:** `@import` of the style's palette, `@import` of the layout's
  `style.css` (which imports `common/base.css`), then one
  `#custom-pin.app-ID { background-image: url("ICON"); }` rule per pinned app.

For a layout with a dock, also `$XDG_RUNTIME_DIR/flickos/dock/sfwbar.config`,
started as `sfwbar -f sfwbar.config` next to waybar:

- the layout's `Dock=` file with the `pins = "flickos/pinned"` line changed to
  the pinned apps' ids (desktop id without `.desktop`, which sfwbar compares
  with window app ids), or removed when none is installed;
- then a `#CSS` line, the style's palette and the layout's `DockStyle=` file,
  copied in (sfwbar loads that CSS from a string, where `@import` can't find
  relative files).

The file is deleted for a layout without a dock. `set` stops the FlickOS
sfwbar (`-f` below `$XDG_RUNTIME_DIR/flickos/`) together with waybar and starts
the new layout's dock, if any.

**Pinned apps:** the desktop file is looked up in `$XDG_DATA_HOME` and
`$XDG_DATA_DIRS` (`applications/ID`). An app is **skipped** if the file doesn't
exist, has `Hidden=true`, isn't `Type=Application`, or its `TryExec` program
isn't installed. So pinning an app from `Recommends` is safe.

**Dock icons** follow the icon theme spec: the current icon theme
(`gsettings get org.gnome.desktop.interface icon-theme`, normally Numix-Circle),
its `Inherits` chain, then Numix, Adwaita, and hicolor last, then `pixmaps/`. The
48 px (or scalable) size is preferred. `Icon=` with an absolute path is used as
is. An app without an icon gets an empty button with a tooltip.

If anything goes wrong while generating (a JSON syntax error, a missing
`include` or palette), `panel` starts flickos-settings' default panel instead,
and `set` keeps the old panel and exits with 1. A dock that can't be generated
is left out (`panel` warns, `set` exits with 1); the bars still start.

### Keeping the panel running

autostart runs `flickos-layout panel` once, so nothing would bring waybar, mako
or the dock back if one of them exited by itself — and waybar does exit when an
output changes under it, which happens in the first seconds of a session in a VM
or with a second monitor. Each of them therefore runs under a supervisor,
`flickos-layout supervise -- COMMAND …`: `panel` itself is waybar's, and mako's
and the dock's are started with `setsid -f`. `set` starts the new panel and dock
the same way.

The supervisor restarts a program that failed after 1 s, doubling the wait up to
8 s, and gives up after `RESTART_LIMIT` (5) failures in a row; one that ran for
`RESTART_HEALTHY_SECONDS` (60) starts counting from zero again. It does **not**
restart a program that was meant to end: one that exited 0, one that was killed
(how `set` stops the old panel), or any of them once the Wayland socket is gone.

Everything they print, and every restart, goes to
**`$XDG_RUNTIME_DIR/flickos/panel.log`** (truncated when it passes 256 KB). The
session's stderr is labwc's, which nobody can read after login, so that file is
the only trace a failed panel leaves; [07](/docs/07-troubleshooting/#live-session--installed-system)
has the symptoms.

The same reasoning applies to the lock the layout commands share
(`$XDG_RUNTIME_DIR/flickos/layout.lock`): autostart starts `wallpaper`, `panel`,
`first-run` and the tiler daemon at once, so waiting for it is given up after 10
seconds (`LOCK_SECONDS`) with a warning, and the command carries on without it.
A sibling that hangs costs a warning, never the panel.

### Commands

| Command | Does |
|---|---|
| `flickos-layout list` | One line per layout: id, name, description (tab-separated) |
| `flickos-layout current` | The layout in use |
| `flickos-layout set [ID] [--style STYLE] [--clicks CLICKS]` | Saves the choice, regenerates the overlay and the panel files and, inside the session, runs `labwc --reconfigure`, restarts the FlickOS panel and, for a new layout, replaces a FlickOS wallpaper with the layout's. Outside a session (no `WAYLAND_DISPLAY`/`LABWC_PID`) it only saves: "applies at next login". `--style` and `--clicks` also set the style and the desktop clicks, with one panel restart. Without `ID` the layout stays |
| `flickos-layout style list`, `style current`, `style set ID` | The same for [styles](#styles-darklight) |
| `flickos-layout clicks list`, `clicks current`, `clicks set ID` | The same for [desktop clicks](#desktop-clicks) |
| `flickos-layout wallpaper` | Shows the [wallpaper](#wallpaper) (autostart): `waypaper --restore` if the user chose one there, else swaybg with `~/.config/flickos/wallpaper`, the layout's or the default wallpaper. If waypaper fails, the layout's |
| `flickos-layout prepare` | Regenerates the overlay (`xdg/`). Run by the session script at login, before labwc starts |
| `flickos-layout panel` | Starts mako with the generated notification config, generates the panel files, starts the layout's dock (sfwbar), then stays on as waybar's [supervisor](#keeping-the-panel-running) (autostart). If anything goes wrong it starts flickos-settings' default panel and notification config. A user's own waybar or mako config is used as is |
| `flickos-layout supervise -- COMMAND …` | Runs one panel program and restarts it when it fails. Started by `panel` and `set`, not meant to be typed |
| `flickos-layout doctor` | Lists user config that stops a layout or style from applying. Exit code 1 if it finds any |
| `flickos-layout state` | Every choice (layouts, styles, clicks, apps button, menu style), the ones in use and `doctor`'s warnings as one JSON object. The Settings window reads its layout page with it |
| `flickos-layout pick` | Opens the [chooser](#the-chooser) |
| `flickos-layout first-run` | Opens the chooser if this is a new account's [first login](#first-login). Run by autostart |

**Which layout is used:** `~/.config/flickos/layout` (written by `set`), else
`Layout=` in `/etc/xdg/flickos/layouts.conf`, else `redmond`. An unknown id
falls back to the next one with a warning, so removing a layout never breaks a
login. Styles (`style`, `Style=`) and desktop clicks (`clicks`, `Clicks=`) are
chosen the same way.

### The chooser

*Settings → Desktop Layout & Style* in the root menu and *Desktop Layout & Style*
in the app launcher both run `flickos-layout pick`:

- **Window:** GTK 3 (python3-gi), so it follows the Arc theme and Numix icons.
  It lists every layout with its preview, name and description, then the styles
  (Dark, Light) as radio buttons with color swatches from their panel palette,
  then the desktop clicks, and marks the current ones. *Apply* (or double-click
  a layout, or Enter) runs `flickos-layout set` in the background with only
  what changed (`ID`, `--style`, `--clicks`), so the panel restarts while the
  window stays open. A style is only passed when it changed, because setting
  one also resets the GTK theme. The line under the list shows what the
  command printed. *Wallpaper…* (only when waypaper is installed) opens
  waypaper.
- **Warnings:** the `doctor` warnings are shown in a yellow bar above the list
  and refreshed after every change.
- **One window only:** a second `pick` finds `$XDG_RUNTIME_DIR/flickos/pick.lock`
  taken, prints "The layout chooser is already open." and exits with 0.
- **Without GTK** (python3-gi missing, or no display): two `fuzzel --dmenu`
  lists, layout then style (`--index`, the current one preselected; desktop
  clicks stay as they are). The result comes as a
  notification (`notify-send`). Without fuzzel too, `pick` exits with 1 and
  points to `list`/`set`.

zenity was the original plan, but zenity 4 uses libadwaita, which ignores Arc and
would add about 12 MB. python3-gi and GTK 3 were already in the image.

**Previews** are schematic drawings in the Arc-Dark palette on the layout's
`wallpaper.jpg`, made by `tools/make-layout-previews.sh` (ImageMagick). Run it
again after changing a wallpaper. Screenshots scaled down to
240×150 are hard to read, so drawings are the default. To use real screenshots
instead: run `tools/boot-test.py` (it saves `boot-test/layout-ID.png` for each
layout), then `tools/make-layout-previews.sh boot-test`. Bump flickos-layouts'
version afterwards. `tests/test_chooser.py` checks every shipped layout has a
240×150 PNG.

### First login

A new account on an installed system sees the **welcome window**
(flickos-welcome) once, at its first login: cards for the layout chooser,
Settings, Wi-Fi, the keyboard shortcuts, the software manager and the project's
links. Each card runs the program that owns that job, and a card whose program
isn't installed is left out.

- Each package ships its own marker in `/etc/skel/.config/flickos/`:
  `welcome` (flickos-welcome) and `choose-layout` (flickos-layouts, for the
  chooser on its own). `adduser` and Calamares copy `/etc/skel` into every new
  home directory, so the account created during installation (and any added
  later) gets them. Existing accounts never do: upgrading doesn't open either.
- autostart runs `flickos-welcome first-run` in the background when that
  package is installed, and `flickos-layout first-run` only when it isn't — so
  exactly one window can open.
- `first-run` opens the window only if `~/.config/flickos/welcome` exists,
  `Enabled=no` isn't set in `/etc/xdg/flickos/welcome.conf`, and `boot=live`
  isn't on the kernel command line.
- It deletes **both** markers in every case, before the window opens, so
  nothing comes back at the next login — not even when the user logs out with
  the window open or closes it without choosing anything (then the default
  layout and style stay).
- The live user is created from `/etc/skel` too, so the markers are there, but
  `first-run` only deletes them. The boot test checks this.

To stop new accounts from seeing it on one machine, set `Enabled=no` in
`/etc/xdg/flickos/welcome.conf`, or delete the markers from `/etc/skel` (dpkg
keeps them deleted, they're conffiles).

The cards are the `CARDS` table in `usr/bin/flickos-welcome`; the addresses
they open are `[Links]` in `welcome.conf`. **A link whose address is empty
shows no card**, which is why `Donate=` ships empty: an address FlickOS doesn't
control must never be shipped as a default.

Test it with `tools/test-iso.sh --install`, then `--disk` (see
[02](/docs/02-building-and-testing/#what-to-check-on-the-installed-system)).

### How a layout is applied

Nothing is copied into the home folder. Each login, `flickos-layout prepare`
writes what the layout needs into **`$XDG_RUNTIME_DIR/flickos/`** (RAM, deleted at
logout), and the session script puts `…/flickos/xdg` first in `XDG_CONFIG_DIRS`.
Updated FlickOS packages therefore reach every user at their next login.

| Overlay file | Contents | Exists when |
|---|---|---|
| `xdg/labwc/rc.xml` | A copy of the first system `rc.xml` in `XDG_CONFIG_DIRS` (skipping the overlay itself), with `<theme><titlebar><layout>` and `<theme><name>` set | It differs from the system file: the layout has `TitlebarLayout`, or the style's window theme isn't the one in the system file |
| `xdg/foot/foot.ini`, `xdg/fuzzel/fuzzel.ini` | `include=` of flickos-settings' config, then of the style's palette ([Styles](#styles-darklight)) | The style isn't Dark |
| `waybar/config.jsonc`, `waybar/style.css` | The generated panel ([above](#the-generated-panel)) | Once the panel has started |
| `mako/config` | `include=` of `/usr/share/flickos/mako/config`, then of the style's `mako.conf` | Once notifications have started |
| `layout.lock` | `flock` lock, so two `set` commands can't interleave | Always |

- A file that isn't needed is **deleted**, so labwc falls back to
  `/etc/xdg/labwc/rc.xml`. With the default layout and style the `xdg/` folder is empty.
- If the system `rc.xml` can't be parsed, the overlay file is deleted with a
  warning, and labwc keeps using the system file.
- Files are written to a temporary name and renamed, so labwc never reads a
  half-written file.
- **Panel restart:** `set` stops only waybar processes of the current user whose
  `-c` config lies under `/usr/share/flickos/` or `$XDG_RUNTIME_DIR/flickos/`
  (SIGTERM, up to 3 seconds so the tray is released, then SIGKILL). It starts the
  new waybar in its own session with the old panel's environment. A waybar the
  user started with their own config is never touched. The waybar started by
  `flickos-layout` has `FLICKOS_LAYOUT=ID` and `FLICKOS_STYLE=ID` in its
  environment. The boot test checks this.
- Open windows keep their buttons until labwc redraws them after
  `labwc --reconfigure`.
- **Windows that draw their own title bar** (Firefox without *Title Bar*, GTK
  header bars, libadwaita apps) show GTK's buttons, not labwc's. `set` changes
  them too ([GTK settings](#gtk-settings-and-nwg-look)); apps pick the change
  up when they restart.

### User config that blocks a layout

User files are respected and never changed. `flickos-layout doctor` (and `set`,
and the chooser) warns about:

| User file or state | Effect |
|---|---|
| `~/.config/waybar/config` or `config.jsonc` | The user's own panel is used; layouts and styles don't change it |
| `~/.config/labwc/rc.xml` | Replaces every system `rc.xml`, including the overlay; window buttons and the window theme don't change |
| `~/.config/labwc/autostart` without `/usr/libexec/flickos/autostart` | The FlickOS panel and notifications aren't started at all |
| `~/.config/foot/foot.ini`, `~/.config/fuzzel/fuzzel.ini`, `~/.config/mako/config` | That program keeps the user's colors when the style changes |
| `gtk-theme` or `icon-theme` not one of the styles' themes (chosen in nwg-look) | Styles don't change it ([GTK settings](#gtk-settings-and-nwg-look)) |
| `button-layout` not one of the layouts' values (set with `gsettings`) | Layouts don't change the buttons of windows that draw their own title bar ([GTK settings](#gtk-settings-and-nwg-look)) |
| A wallpaper chosen in waypaper (`wallpaper =` in `~/.config/waypaper/config.ini`), or `~/.config/flickos/wallpaper` | Layouts don't change the wallpaper ([Wallpaper](#wallpaper)) |
| Session started before `flickos-layouts` was installed | The overlay isn't in `XDG_CONFIG_DIRS`; window buttons, borders, terminal and launcher colors change after logging out and in |

### Desktop clicks

What a click on the empty desktop does. Users choose in the chooser, or with
`flickos-layout clicks set ID`:

| Id | Left click | Right click |
|---|---|---|
| `right-menu` (**default**) | Nothing | Desktop (root) menu |
| `both-menu` | Desktop menu | Desktop menu (labwc's own default) |
| `left-launcher` | App launcher (fuzzel) | Desktop menu |

Middle click keeps labwc's default (the desktop menu). **Every** desktop click
also runs `pkill -x fuzzel`: labwc doesn't move the keyboard focus when the
desktop is clicked, so fuzzel wouldn't notice the click and stay open. While
the [start menu](#start-menu) is on, the clicks come from `MENU_CLICK_ACTIONS`
instead: every click also closes the menu, and `left-launcher` opens the menu.

- **Where:** the choices are built into `flickos-layout` (`CLICKS` and
  `CLICK_ACTIONS`), not files. flickos-settings' `rc.xml` has the `right-menu`
  bindings in `<mouse><context name="Root">`, after `<default />`.
- **How:** any other choice makes `prepare`/`set` write the overlay `rc.xml`
  with the `Left` and `Right` `Press` bindings of the last `Root` context
  replaced. The default needs no overlay, so an administrator's own bindings in
  the system `rc.xml` stay until a user picks another choice.
- **Change the default:** `Clicks=` in `layouts.conf`. If you change the
  bindings in flickos-settings' `rc.xml`, change `DEFAULT_CLICKS` or
  `CLICK_ACTIONS` to match (the fixture `tests/fixtures/rc.xml` has a copy, and
  `ClicksTest` checks it).

### Start menu

A classic start menu for the apps button (package `flickos-menu`, see
[04](/docs/04-packages/#flickos-menu) and
[design/flickos-menu.md](https://github.com/dvbondoy/FlickOS/blob/main/docs/design/flickos-menu.md)). **On by default**: the apps
button and a tap of Super open it; Super+D stays fuzzel. A user switches it
under *Apps button* in *Settings → Desktop Layout & Style*, or:

```sh
flickos-layout launcher list          # fuzzel, and menu while flickos-menu is installed
flickos-layout launcher set fuzzel    # off: the menu's daemon stops, applies at once
flickos-layout launcher set menu      # on again
flickos-layout launcher set default   # back to the system default (the menu)
```

While it is on, for a layout with a `Menu=` corner:

| What | Where it comes from |
|---|---|
| The apps button opens it | `custom/launcher`'s `on-click` in the generated `waybar/config.jsonc` (`MENU_TOGGLE`) |
| A tap of Super opens it (a hold still shows the shortcut sheet) | `Super_L`/`Super_R` `onRelease` keybinds in the rc.xml overlay (`MENU_SUPER`) |
| A desktop click closes it | `MENU_CLICK_ACTIONS` in the rc.xml overlay |
| It opens in the button's corner, in the layout's style | `$XDG_RUNTIME_DIR/flickos/menu/anchor`, from `Menu=` and `MenuStyle=` |
| It opens at once | `flickos-menu daemon`, run by `flickos-layout panel` under `supervise` |

While it is off, none of these exist. Super+D and Alt+F3 stay fuzzel either way.

**Each layout has its own kind of menu**, `MenuStyle=` in its `layout.ini`:

| `MenuStyle=` | Used by | What it is |
|---|---|---|
| `classic` (default) | Redmond | Windows 7: pinned apps, All apps, search; user, folders, Settings, Software, power |
| `categories` | Traditional | GNOME 2/Whisker: search on top, categories left (Favorites, All apps, sections, Folders), apps right as you point at a category, user and power buttons below |
| `grid` | Cupertino | Launchpad: every app as a big icon, full screen and see-through; click the background or press Escape to close |

A user can pick one style for every layout instead, under *Start menu
style* in the Settings page, or:

```sh
flickos-layout menu-style list        # layout (each layout's own, the default), classic, categories, grid
flickos-layout menu-style set grid    # the grid in every layout, in the layout's corner
flickos-layout menu-style set layout  # back to each layout's own
```

`MenuStyle=` in `[Defaults]` of `layouts.conf` sets it for users who haven't
chosen (default `layout`).

A style is a `View` subclass in `flickos-menu` (`VIEWS`; add its name to
`MENU_STYLES` in both flickos-menu and flickos-layout). Its CSS is under
`.flickos-menu.style-NAME` in `style.css`. After `flickos-layout set`, a running
menu builds the new layout's style in the background, so it opens at once.

**Default pinned apps:** `Pinned=` in
`packages/flickos-menu/etc/xdg/flickos/menu.conf` (conffile), desktop ids
separated by `;`. The live session reads
`packages/flickos-installer/etc/xdg/flickos-live/flickos/menu.conf`, which
has *Install FlickOS* first; keep the rest the same. A user who pins or unpins
an app (right-click it, or `flickos-menu pin|unpin ID`) gets their own list in
`~/.config/flickos/menu`.

**Make fuzzel the default for everyone again:** `Launcher=fuzzel` in
`packages/flickos-layouts/etc/xdg/flickos/layouts.conf` (or on one machine in
`/etc/xdg/flickos/layouts.conf`).

**Other changes** are in `packages/flickos-menu/usr/bin/flickos-menu`:
`SECTIONS` (All apps' categories), `TOOLS` and `POWER` (right column), `PLACES`
(folders), `TAP_MS` (keep it below flickos-shortcuts' `HOLD_MS`), the sizes
`WIDTH_LEFT`, `WIDTH_RIGHT`, `HEIGHT` (classic), `CategoriesView.WIDTH`/`HEIGHT`,
`ICON_GRID`. The look is
`usr/share/flickos/menu/style.css`: GTK theme colors only (`@theme_bg_color`,
…), so both styles recolor it.

**Try it from the source tree:** in a FlickOS session, with the menu on,
`FLICKOS_MENU_PREFIX=$PWD FLICKOS_MENU_TIMING=1 usr/bin/flickos-menu daemon`
in `packages/flickos-menu` (after `pkill -x flickos-menu`), then click the
button. The times are in `$XDG_RUNTIME_DIR/flickos/menu/timing.log`;
`flickos-menu bench` times the index and search.

### Adding a layout

1. Copy a folder in `packages/flickos-layouts/usr/share/flickos/layouts/`, e.g.
   `redmond` to `mylayout`, and change `Name`, `Comment` and `Order` in
   `layout.ini`.
2. Edit `waybar.jsonc`. Start every bar with
   `"include": "../common/modules.jsonc"` and only override the settings that
   differ (values in the bar win over the included file). Give each bar a
   distinct `"name"`: waybar adds it as a CSS class (`window#waybar.NAME`).
   Put `"tray"` and `"custom/launcher"` in exactly **one** bar each.
3. Edit `style.css`. Keep `@import url("../common/base.css");` at the top. Use
   **named colors only** (`@wm_bg`, `@bg_color`, `@base_color`, `@fg_color`,
   `@selected_bg_color`, `@selected_fg_color`, `@borders`, `@warning_color`,
   `@error_color`), plus `transparent` and `alpha(@name, 0.8)`. The palette may
   change with a style, so color values like `#383c4a` are rejected by the tests.
4. Set `Menu=` to the corner of the bar with the apps button (`bottom-left` or
   `top-left`), and `MenuStyle=` if it shouldn't be `classic`, for the
   [start menu](#start-menu).
5. Add the id to `EXPECTED` in `tests/test_layouts.py`, and the CSS file (and a
   `DockStyle=` file) to `FILES` in `tools/check-palette.py`.
6. Add a preview: the id to `IDS` and a `draw` block in
   `tools/make-layout-previews.sh`, then run it. Keep `Preview=preview.png` in
   `layout.ini`.
7. Bump the version (`dch -i -D trixie`) and run `sh packages/build.sh`.

`tests/test_layouts.py` checks every shipped layout: `waybar.jsonc` parses (with
comments), includes and CSS imports exist, exactly one tray and one launcher,
every module in `modules-left/center/right` is defined in the bar or its
includes, `flickos/pinned` is used (in a bar or the dock's `pins` line)
exactly when `Pinned=` is set, a dock config starts with `#Api2` and has no
`#CSS` section, `TitlebarLayout` is valid, and the CSS (with `DockStyle=`) only
uses color names from the palette.

A new common module goes into `common/modules.jsonc`, and its styling into
`common/base.css`.

### Changing the default layout

Edit `Layout=` in `packages/flickos-layouts/etc/xdg/flickos/layouts.conf` and bump
the version. It's a conffile: if an administrator edited it, dpkg asks before
replacing it.

### Testing without a VM

```sh
cd packages/flickos-layouts && python3 -m unittest discover -s tests
cd ../..
HOME=$(mktemp -d) XDG_RUNTIME_DIR=$(mktemp -d) GSETTINGS_BACKEND=memory \
  XDG_CONFIG_DIRS=$PWD/packages/flickos-settings/etc/xdg \
  FLICKOS_LAYOUT_PREFIX=$PWD/packages/flickos-layouts \
  FLICKOS_SETTINGS_PREFIX=$PWD/packages/flickos-settings \
  packages/flickos-layouts/usr/bin/flickos-layout prepare    # then look in $XDG_RUNTIME_DIR/flickos/
```

`FLICKOS_LAYOUT_PREFIX` makes the tool read layouts, styles and `layouts.conf`
from the source tree instead of `/usr` and `/etc`. `FLICKOS_SETTINGS_PREFIX`
does the same for flickos-settings' foot, fuzzel and mako configs, which the
style files include. **Keep `GSETTINGS_BACKEND=memory`** when trying
`style set`: without it, the command changes the GTK settings of the desktop
you're working on.

The chooser works the same way (`… flickos-layout pick`) on any Wayland or X11
desktop. With a temporary `XDG_RUNTIME_DIR`, set `WAYLAND_DISPLAY` to the full
socket path (e.g. `/run/user/1000/wayland-0`) so GTK still finds the display.
Outside labwc, *Apply* only saves the choice.

Then look at `$XDG_RUNTIME_DIR/flickos/waybar/` after
`… flickos-layout set cupertino` (same variables). Add
`XDG_DATA_DIRS=$PWD/chroot/usr/share` after a build to resolve pinned apps and
icons against the image's files.

In a VM: `flickos-layout set cupertino`, then `traditional` and `redmond`, in a
terminal. The panel should restart once each time, `pgrep -c waybar` should print
`1`, `pgrep -c sfwbar` `1` for Cupertino and `0` otherwise, and the network icon
should come back in the tray. The boot test does the
same (checks *switch to …* and *tray survives the switch*) and saves
`boot-test/layout-redmond.png`, `layout-cupertino.png` and
`layout-traditional.png`.

**Check in a VM** when changing bars: window titles are cut at the set length
(`{title:.28}`). For the dock: it is shown on every monitor; maximized windows reach the
bottom edge; it hides while a maximized window is active (only on that
window's monitor) and comes back when it is restored, minimized or another
window is activated; pinned apps launch on click; open apps get the line under
their icon.

---

## Styles (Dark/Light)

A **style** recolors the desktop. Styles come from `flickos-layouts`, next to the
layouts, and are chosen in the same [chooser](#the-chooser) or with
`flickos-layout style set ID`. Both apply right away.

| Id | Name | GTK theme | Icons | Window theme (labwc) | `color-scheme` |
|---|---|---|---|---|---|
| `dark` (**default**) | Dark | `Arc-Dark` | `Numix-Circle` | `FlickOS-Arc-Dark` | `prefer-dark` |
| `light` | Light | `Arc` | `Numix-Circle-Light` | `FlickOS-Arc` | `default` |

**What follows the style:** GTK apps, icons, window borders and title bars, the
root and window menus, Alt+Tab, the panel, the app launcher (fuzzel, including
its icon theme), notifications, and **new** terminal windows.

**What doesn't:**

- Open foot windows keep their colors until they're closed.
- Boot menus, boot splash, installer and the lock screen's color (`swaylock
  -c`, unless *Settings → Power & Idle* shows the wallpaper there) are always
  Arc-Dark, and so is the wallpaper's fill color. They run before or outside
  the user session.
- libadwaita apps always look like Adwaita
  ([GTK theme](#gtk-theme-icons-cursor-fonts-dark-mode)); with Light they at
  least follow `color-scheme`.
- A GTK or icon theme the user chose in *Appearance* ([below](#gtk-settings-and-nwg-look)).

### Style files

| File in `packages/flickos-layouts/usr/share/flickos/styles/ID/` | Purpose |
|---|---|
| `style.ini` | `[Style]` `Name`, `Comment`, `Order`, `GtkTheme`, `IconTheme`, `LabwcTheme`, `ColorScheme` (`default`, `prefer-dark` or `prefer-light`), and the palette files `Waybar`, `Foot`, `Fuzzel`, `Mako` (relative to the folder, or absolute) |
| `waybar-colors.css` | `@define-color` for the panel. Same names in every style; layout CSS uses only these names |
| `foot.ini` | `[colors]`: `alpha`, background, foreground and the 16 ANSI colors |
| `fuzzel.ini` | `[main] icon-theme` and `[colors]` |
| `mako.conf` | Background, text and border colors, and the `[urgency=critical]` border |

A style with a missing key or an invalid `ColorScheme` isn't listed. The window
themes live in flickos-settings: `usr/share/themes/FlickOS-Arc-Dark/labwc/themerc`
and `usr/share/themes/FlickOS-Arc/labwc/themerc`.

**flickos-settings' configs keep the Arc-Dark colors**
(`/etc/xdg/flickos/foot/foot.ini`, `fuzzel.ini`, `/usr/share/flickos/mako/config`),
so each program still works on its own. A style's files hold only colors. They are
included **after** the base config, so their keys win:

```ini
# $XDG_RUNTIME_DIR/flickos/xdg/foot/foot.ini, generated for the Light style
include=/etc/xdg/flickos/foot/foot.ini
include=/usr/share/flickos/styles/light/foot.ini
```

Dark's colors are the same as the base configs, so Dark needs no foot or fuzzel
overlay file. mako's config is always generated, because mako is started with
`-c` and a path can't change without restarting it; `makoctl reload` picks up the
new include.

### How a style is applied

`flickos-layout style set ID` (under the same lock as layouts):

1. Saves `~/.config/flickos/style`.
2. Regenerates the overlay ([table](#how-a-layout-is-applied)): `rc.xml` with
   `<theme><name>` set to the style's window theme, the foot and fuzzel files,
   `mako/config` and the panel's `style.css`.
3. Changes the [GTK settings](#gtk-settings-and-nwg-look). This happens even
   outside the session, because GTK settings live in dconf, not in the overlay.
4. Inside the session: `labwc --reconfigure` (window theme, menus),
   `makoctl reload`, then restarts the FlickOS panel.

**The window theme** in the overlay is only replaced if the system `rc.xml`
selects one of the styles' themes. An administrator who changed
`/etc/xdg/labwc/rc.xml` to their own theme keeps it.

**Which style is used:** `~/.config/flickos/style`, else `Style=` in
`/etc/xdg/flickos/layouts.conf`, else `dark`. An unknown id falls back with a
warning.

### GTK settings and nwg-look

`style set` always sets `color-scheme`. It changes `gtk-theme` and `icon-theme`
**only while they hold one of the styles' themes** (`Arc`/`Arc-Dark`,
`Numix-Circle`/`Numix-Circle-Light`). A theme chosen in *Settings → Appearance*
(nwg-look), e.g. Adwaita or Papirus, is kept, and `doctor` says so.

A layout change touches only `button-layout` (`org.gnome.desktop.wm.preferences`):
the buttons of windows that draw their own title bar, like Firefox without
*Title Bar* or GTK header bars. `set` translates the layout's `TitlebarLayout`
into GTK's words (`iconify` → `minimize`, `max` → `maximize`; `shade` and
`desk` have none and are left out), so Cupertino gives `close,minimize,maximize:`.
A layout without `TitlebarLayout` resets the key to flickos-settings' default
([below](#gtk-theme-icons-cursor-fonts-dark-mode)). This happens **only while
the key holds the default or one of the layouts' values**. A value the user
set is kept, and `doctor` says so. The default comes from
`GSETTINGS_BACKEND=memory gsettings get …`, which has no user values.

**nwg-look** (`Recommends` of flickos-desktop and flickos-settings, menu entry
*Settings → Appearance*) is a GTK settings editor for wlroots compositors:
GTK theme, icons, cursor, fonts, color scheme. It applies them through
GSettings, which GTK apps under Wayland read, and can export them to
`~/.config/gtk-3.0/settings.ini` and `~/.gtkrc-2.0` for other apps. The FlickOS defaults are in
[GTK theme, icons, cursor, fonts, dark mode](#gtk-theme-icons-cursor-fonts-dark-mode).
It doesn't recolor FlickOS's panel, terminal, launcher or window borders; that
is what styles are for.

### Adding a style

1. Copy `styles/dark` to `styles/myid` in `packages/flickos-layouts/usr/share/flickos/`,
   and set `Name`, `Comment`, `Order` and the theme names in `style.ini`.
   The GTK and icon themes must be installed (add their packages to
   flickos-settings' `Depends`).
2. Change the colors in the four palette files. Keep exactly the same keys and
   color names.
3. For a new window theme, copy a folder in
   `packages/flickos-settings/usr/share/themes/` and add it to `LABWC_THEMES` in
   `tools/check-palette.py`.
4. Add the palette files to `tools/check-palette.py` (in `FILES` or
   `LIGHT_FILES`, or a new palette) and the id to `EXPECTED` in
   `tests/test_styles.py`.
5. Bump the versions of both packages.

**Checks:** `tests/test_styles.py` (at package build) checks that every style
loads, sets the same waybar color names and the same foot, fuzzel and mako keys,
and that fuzzel's icon theme matches `IconTheme`. `tools/check-palette.py` (run
by `build-iso.sh`) checks the colors, that both labwc themes use the same valid
keys, and that each style's foot, fuzzel and mako file sets exactly the color
keys of flickos-settings' base configs, with Dark's values equal to them. So a
color key added to a base config must be added to every style.

**Changing the default style:** `Style=` in `etc/xdg/flickos/layouts.conf`. New
users' GTK settings still come from flickos-settings'
`90_flickos-settings.gschema.override`, so change `gtk-theme`, `icon-theme` and
`color-scheme` there too.

**Testing without a VM:** see [Testing without a VM](#testing-without-a-vm)
(`… flickos-layout style set light`, with `GSETTINGS_BACKEND=memory`), then
`foot --check-config -c $XDG_RUNTIME_DIR/flickos/xdg/foot/foot.ini` and
`fuzzel --check-config --config $XDG_RUNTIME_DIR/flickos/xdg/fuzzel/fuzzel.ini`.
The boot test switches to Light and back, checks GTK settings, overlay files,
panel and notifications, that a custom GTK theme is kept, and saves
`boot-test/style-light.png` and `style-dark.png`.

---

## Window tiling

`flick-tiler` (package `packages/flick-tiler/`) arranges windows side by side
while labwc stays the window manager. It is off by default. Users turn it on
with **Super+T** or the panel button (left click: on/off, right click: choose
the arrangement, scroll: next arrangement). The choice is saved in
`~/.config/flickos/tiler`.

| Arrangement (`flick-tiler modes`) | Windows |
|---|---|
| `master-stack` (**default**) | Main window on the left (`MasterRatio`, 55%), the others stacked on the right |
| `columns` | Side by side, equal widths |
| `grid` | Rows and columns |
| `monocle` | All full screen; Super+J/K brings the next one to the front |

Keys while tiling is on:

| Key | Action |
|---|---|
| `Super+J` / `Super+K` | Focus the next / previous tiled window |
| `Super+Shift+J` / `Super+Shift+K` | Move the focused window forward / back |
| `Super+Shift+Enter` | Make the focused window the main one |
| `Super+M` | Next arrangement |
| `Super+[` / `Super+]` | Main window narrower / wider |
| `Super+Shift+T` | Tile the focused window (a window that was open before tiling, or was dragged out) |
| `Super+Shift+F` | Let the focused window float |

**How it works.** labwc 0.8 has no way for another program to move a window.
It does have *regions*: named rectangles in percent of the screen, to which a
window is tiled with `SnapToRegion`. When labwc reloads its config, every
window follows the new geometry of its region, and a window whose region is
gone is released (it floats, centered). So:

1. The daemon (`flick-tiler daemon`) follows the windows over
   wlr-foreign-toplevel. Autostart starts it at login and it runs for the
   whole session, tiling on or off, so Super+T takes effect at once. A lock
   (`tiler/daemon.lock`) allows one daemon at a time. While tiling is off it
   writes no fragment, so labwc runs with the plain FlickOS config.
2. It writes a fragment, `$XDG_RUNTIME_DIR/flickos/tiler/labwc.xml`:
   one region per tiled window (`ft1`, `ft2`, …), a window rule that snaps every
   new window to the next unused region, the keys above and `<core><gap>`.
3. `flickos-layout reconfigure` merges the fragment into the rc.xml overlay
   (like the layout's window buttons) and reloads labwc.
4. When a window opens or closes, is minimized, or the arrangement or order
   changes, the daemon computes the regions again. Moving a window only swaps
   the geometry of two regions.

Turning tiling off deletes the fragment, so labwc releases every window.
A fragment left by a daemon that died is deleted by the next `flick-tiler off`
or daemon start.

The panel button keeps no process running: waybar runs `flick-tiler status`
once, again after each click, and whenever flick-tiler sends it `SIGRTMIN+8`
(`"signal": 8` in `modules.jsonc`, `PANEL_SIGNAL` in `flick-tiler`). Idle cost
while tiling is off: nothing; while on: the daemon, about 18 MB.
Dialogs (windows with a parent) and the app ids in `Float=` are released right
after they open.

Problems: [07 – Window tiling](/docs/07-troubleshooting/#window-tiling-flick-tiler)
has the symptom-by-symptom guide, the runtime files and how to watch the
daemon.

**Limits:** windows that were already open when tiling was turned on stay
floating until Super+Shift+T (labwc runs window rules only when a window
opens); a notification says how many. A window dragged out of its place still counts
until it is tiled again or closed. All outputs use the same arrangement, and
there is one layout for all workspaces (FlickOS has no workspace switcher).
Two windows that open in the same instant can land in the same place.

- **Defaults for everyone:** `etc/xdg/flickos/tiler.conf` (`Enabled=yes` turns
  it on for users who haven't chosen).
- **A new arrangement:** add it to `MODES` and `arrange()` in `flick-tiler`,
  and an icon rule `#custom-tiler.ID` in flickos-layouts' `layouts/common/base.css`.
- **Keys:** `KEYBINDS` in `flick-tiler`; Super+T itself is in flickos-settings'
  `rc.xml`, so it works while tiling is off.
- **Try it without a package:** `flick-tiler` needs no install to run
  (`FLICK_TILER_PREFIX=packages/flick-tiler packages/flick-tiler/usr/bin/flick-tiler daemon`
  inside a labwc session), but `flickos-layout reconfigure` must be the
  installed 1.7 or later.

## Wallpaper

Each [desktop layout](#desktop-layouts) has its own wallpaper
(`Wallpaper=wallpaper.jpg` in `layout.ini`), and switching the layout switches
it. At login, autostart runs `flickos-layout wallpaper`, which shows the first
of these that exists:

1. **The user's choice in waypaper** (*Settings → Wallpaper*, or the chooser's
   *Wallpaper…* button): `waypaper --restore`.
2. **`~/.config/flickos/wallpaper`** (an image file or a link to one; the older
   way, still supported): `swaybg`.
3. **The layout's wallpaper:** `swaybg`.
4. **flickos-settings' `/usr/share/backgrounds/flickos/default.jpg`**
   ([Artwork](#artwork)), for layouts without one.

A choice whose image no longer exists is skipped. A user's own wallpaper (1 or 2)
is never replaced by a layout switch, and `flickos-layout doctor` reports it.
To follow the layouts again, the user deletes the `wallpaper =` line in
`~/.config/waypaper/config.ini` (or `~/.config/flickos/wallpaper`).

**Layout switch:** `flickos-layout set ID` starts `swaybg` with the new
wallpaper, waits half a second so it is drawn, then stops the old one. It only
replaces a `swaybg` whose image is under `/usr/share/flickos/layouts/` or
`/usr/share/backgrounds/flickos/`, and only while the user has no own choice.

**Replace a layout's wallpaper:** put a JPEG at
`packages/flickos-layouts/usr/share/flickos/layouts/ID/wallpaper.jpg`, at least
1920×1080, at most 3840 px wide (about 1 MB; each one adds to the ISO). Make
sure you have the right to redistribute it, and record its author and license in
flickos-layouts' `debian/copyright` (the current ones are Unsplash photos). Then
run `tools/make-layout-previews.sh` (the previews show it) and bump flickos-layouts.
To scale down a large photo:

```sh
magick photo.jpg -auto-orient -resize '3840x2560>' -strip -quality 88 wallpaper.jpg
```

**Scaling:** `swaybg … -m fill` in `swaybg_command()` in `flickos-layout` (and
the fallback in the autostart script). The modes are `fill` (crop), `fit`
(letterbox, uses the `-c` color around the image), `stretch`, `center` and
`tile`. In waypaper, the user picks one.

### waypaper (Settings → Wallpaper)

[waypaper](https://github.com/anufrievroman/waypaper) is a GTK 3 wallpaper
picker that runs swaybg. Debian trixie doesn't have it, so FlickOS packages
it: `packages/waypaper/` is upstream's code, installed as is (nothing is
built). `debian/README.source` there lists the FlickOS changes and how to
update to a new upstream release. It is a Depends of flickos-desktop, so
installed systems get it too.

FlickOS defaults are in `/etc/xdg/waypaper/config.ini` (a FlickOS patch in
`config.py` reads it before the user's config): the folders
`/usr/share/backgrounds/flickos` (the layouts' wallpapers and the default) and
`~/Pictures`, backend `swaybg`, mode `fill` and the Arc-Dark background color.
Don't put `wallpaper =` there: that would count as every user's own choice.

---

## Default apps

"Default apps" means two different things.

### A. Which apps are installed

Edit `packages/flickos-desktop/debian/control`. Follow
[04 – Adding or removing a desktop package](/docs/04-packages/#adding-or-removing-a-desktop-package)
and read the Recommends caveat in [04](/docs/04-packages/#flickos-desktop-meta-package).

Current defaults (all in `Recommends:`):

| Purpose | Package | Desktop file |
|---|---|---|
| Web browser | `firefox-esr` | `firefox-esr.desktop` |
| Ad blocker for Firefox (on by default) | `webext-ublock-origin-firefox` | none |
| Text editor | `mousepad` | `org.xfce.mousepad.desktop` |
| Image viewer | `ristretto` | `org.xfce.ristretto.desktop` |
| PDF viewer | `evince` | `org.gnome.Evince.desktop` |
| Office suite | `libreoffice-writer`, `-calc`, `-impress`, `-draw`, `-gtk3`, `hunspell-en-us`, `hyphen-en-us` | `libreoffice-writer.desktop`, `libreoffice-calc.desktop`, `libreoffice-impress.desktop` |
| Media player | `vlc` | `vlc.desktop` |
| Archive manager | `xarchiver` | `xarchiver.desktop` |
| File manager | `pcmanfm` | `pcmanfm.desktop` |
| Terminal | `foot` | `foot.desktop` |
| Display settings | `wdisplays` | `network.cycles.wdisplays.desktop` |
| Network settings | `nm-connection-editor` | `nm-connection-editor.desktop` |
| Sound settings | `pavucontrol` | `org.pulseaudio.pavucontrol.desktop` |
| Bluetooth | `blueman` | `blueman-manager.desktop` |
| Printers | `cups`, `system-config-printer` | `system-config-printer.desktop` |
| Software manager and updates | `gnome-packagekit`, `gnome-package-updater` | `org.gnome.Packages.desktop`, `org.gnome.PackageUpdater.desktop` |
| CPU microcode (no app) | `intel-microcode`, `amd64-microcode` | – |

**Check the cost before adding an app.** A small app can pull in large
libraries. Atril, for example, brought a whole web engine (~200 MB) for EPUB
support, so FlickOS uses Evince (~20 MB) instead. Check on a trixie machine:

```sh
apt-get install --simulate --no-install-recommends PACKAGE | grep '^Inst' | wc -l   # packages it adds
apt-cache show PACKAGE | grep Installed-Size                                          # its own size, KB
```

After a build, `flickos-amd64.packages` lists everything in the image, and the
boot test's `memory.txt` shows memory use ([02](/docs/02-building-and-testing/#results)).

**Swapping an app** (e.g. Chromium instead of Firefox) touches three places:

1. `flickos-desktop/debian/control`: replace the package.
2. `flickos-settings/etc/xdg/flickos/mimeapps.list`: replace the desktop file name.
3. `flickos-settings/etc/xdg/labwc/menu.xml`, `rc.xml` and
   `flickos-installer/etc/xdg/flickos-live/labwc/menu.xml`: only if the app is
   called by name. The terminal, browser and file manager are not: Super+Enter
   and the menu run `xdg-terminal-exec` (FlickOS's default:
   `flickos-settings/etc/xdg/flickos/xdg-terminals.list`), Super+B and Super+E
   run `/usr/libexec/flickos/open-default browser|files`, which start the
   `mimeapps.list` default. A new terminal needs only a line in `xdg-terminals.list`.

Find a package's desktop file name: `dpkg -L PACKAGE | grep '\.desktop$'`.

### B. Which app opens which file type

File: `packages/flickos-settings/etc/xdg/flickos/mimeapps.list`.

```ini
[Default Applications]
application/pdf=org.gnome.Evince.desktop
image/png=org.xfce.ristretto.desktop
```

- Find a file's MIME type in a VM: `xdg-mime query filetype somefile.pdf`.
- Check the result: `xdg-mime query default application/pdf`.
- Only reference apps that are installed. Other entries are ignored.
- Users override with `~/.config/mimeapps.list`.

Users choose their own in *Settings → Default Applications*, which writes
`~/.config/mimeapps.list` (`xdg-mime default`) and `~/.config/xdg-terminals.list`.

### Default terminal and browser alternatives

FlickOS's own keys, menu and launcher use the user's choice (above). Other
programs asking the system for "a terminal" (pcmanfm's *Open in Terminal*, via
libfm's `terminal=x-terminal-emulator %s`) or "a browser" (`x-www-browser`) use
Debian's *alternatives*, which are system-wide. foot and firefox-esr register themselves for these.
Check with `update-alternatives --display x-terminal-emulator` and
`update-alternatives --display x-www-browser`.

---

## Settings window

*Settings → All Settings* opens the Settings window (package `flickos-control`,
see [04](/docs/04-packages/#flickos-control)). Every page runs the command that owns
the setting, so the window, the panel, the keys and the command line always
agree. Mouse, touchpad and keyboard settings are flickos-control's own.

| Page | Runs |
|---|---|
| Desktop Layout & Style | `flickos-layout list/current/set`, `style …`, `clicks …`, `doctor` |
| Mouse & Touchpad, Keyboard, Power & Idle | `flickos-control set KEY VALUE` (`flickos-control get` lists them); the system layout: `pkexec /usr/libexec/flickos/control-helper keyboard …` |
| Default Applications | `xdg-mime default APP TYPES…`; the terminal: `~/.config/xdg-terminals.list` |
| Date & Time | `timedatectl set-timezone`, `set-ntp` |
| Login | `pkexec /usr/libexec/flickos/control-helper autologin-on`, `autologin-off` |
| Firewall | `pkexec /usr/libexec/flickos/control-helper firewall-on`, `firewall-off` (`ufw --force enable`, `ufw disable`); state from `/etc/ufw/ufw.conf` |
| About | `flickos-control about` (also `lspci`, `dpkg-query`); *Copy System Info*: `wl-copy` |
| Tiling | `flick-tiler status/modes/on/off/mode/ratio/gap/floating` |
| Keyboard Shortcuts | `flickos-shortcuts list`, `show` |
| More Settings | the apps in `TILES` (the same as the Settings menu) |

- **Add a tile for another settings app:** a line in `TILES` in
  `usr/bin/flickos-control` (id, name, icon names, command). Tiles of apps that
  aren't installed are hidden, so a Recommends is enough. Add the app to the
  Settings menu too (both files, see [Menu entries](#menu-entries)).
- **Change the mouse, touchpad, keyboard or idle defaults for everyone:**
  uncomment lines in `/etc/xdg/flickos/input.conf`, `keyboard.conf` or
  `idle.conf` (conffiles of flickos-control). Users' own choices still win.
- **Add a mouse, touchpad or keyboard option:** a `Setting` in `SETTINGS`
  (labwc category and element, default) and a `control()` row on the page.
  Check the element in labwc's `src/config/rcxml.c` first: labwc ignores what
  it doesn't know, without a message. The tests compare every option against
  their copy of labwc 0.8.3's list (`LABWC_LIBINPUT`, `LABWC_KEYBOARD`); add
  it there if it is new in labwc.
- **Add a page:** a class with `widget` and `shown()` (called each time the
  page is shown) in `PAGE_CLASSES`, and a `Page` in `PAGES`. Read and change
  the setting through the command that owns it; if that command lacks
  something, add it there (that is how `flick-tiler floating` came about).
  Use stock GTK widgets only: they follow both styles without CSS.
- **Try it without building:** run `usr/bin/flickos-control --page ID` from the
  source tree inside the session; set `FLICKOS_LAYOUT_PREFIX` to
  `packages/flickos-layouts` to see the layout previews from the tree.

The design and its decisions are in
[design/flickos-control.md](https://github.com/dvbondoy/FlickOS/blob/main/docs/design/flickos-control.md).

---

## Menu entries

### A. labwc root menu (right-click on the desktop)

Which clicks open it is a user setting: [Desktop clicks](#desktop-clicks).

| Session | File |
|---|---|
| Installed system | `packages/flickos-settings/etc/xdg/labwc/menu.xml` |
| Live session | `packages/flickos-installer/etc/xdg/flickos-live/labwc/menu.xml`: the same menu plus *Install FlickOS* at the top |

**Change both files** when you edit the menu. The live copy only differs in
its first two lines inside `root-menu`. `tools/check-menus.py` (run by
`tools/build-iso.sh`) fails if the files differ in anything else except comments
and whitespace.

Current structure: Terminal, Web Browser, Files, Applications; **Office**
(Writer, Calc, Impress); Media Player; **Settings**
(Desktop Layout & Style, Wallpaper, Appearance, Displays, Network, Sound, Bluetooth, Printers, Reload Desktop Config);
**Session** (Lock Screen, Log Out, Suspend, Reboot, Shut Down).

Add an item:

```xml
<item label="Text Editor"><action name="Execute"><command>mousepad</command></action></item>
```

Add a submenu. Every `id` must be unique:

```xml
<menu id="office-menu" label="Office">
  <item label="Writer"><action name="Execute"><command>libreoffice --writer</command></action></item>
</menu>
```

`systemctl reboot`/`poweroff`/`suspend` work without sudo for the user at the
machine. logind allows the active local session to do this. Reference:
`man labwc-menu`, `man labwc-actions`. Test menu changes in a VM with *Settings →
Reload Desktop Config*.

### B. App launcher (fuzzel, `Super+D`)

fuzzel lists every `.desktop` file in `applications/` folders under
`XDG_DATA_DIRS`. Installed packages add their own entries.

**Add an entry for a command:** create e.g.
`packages/flickos-settings/usr/share/applications/flickos-about.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=About FlickOS
Comment=Version and system information
Exec=foot -H sh -c 'cat /etc/os-release; uname -a'
Icon=help-about
Terminal=false
Categories=System;
```

Add `usr/share/applications/*   usr/share/applications/` to
`flickos-settings/debian/install`. Validate with `desktop-file-validate FILE`
(package `desktop-file-utils`). Only use `flickos-` file names, so they never
clash with another package.

**Hide another package's entry:** copy its desktop file into
`packages/flickos-settings/usr/share/flickos/applications/` under the **same
file name**, and add `NoDisplay=true` directly under the `[Desktop Entry]` line.
The copy wins because `/usr/share/flickos` comes first in `XDG_DATA_DIRS`.
Example candidates: `org.xfce.mousepad-settings.desktop`, `blueman-adapters.desktop`.

---

## Keybindings

File: `packages/flickos-settings/etc/xdg/labwc/rc.xml`, section `<keyboard>`.

### Current bindings

`<default />` at the top loads labwc's built-in bindings. FlickOS's own
bindings follow, and replace defaults that use the same key.

| Key | Action | Source |
|---|---|---|
| Hold `Super` alone | Keyboard shortcut sheet until Super is let go ([Shortcut sheet](#shortcut-sheet-hold-super)) | FlickOS |
| `Super+Enter` | Terminal (foot) | FlickOS |
| `Super+D`, `Alt+F3` | App launcher (fuzzel); closes it when it is open | FlickOS |
| `Super+E` | Files (pcmanfm) | FlickOS |
| `Super+B` | Web browser | FlickOS |
| `Super+V` | Clipboard history | FlickOS |
| `Super+Q`, `Alt+F4` | Close window | FlickOS, labwc |
| `Super+L` | Lock screen (`/usr/libexec/flickos/lock`: the background chosen in *Settings → Power & Idle*) | FlickOS |
| `Super+Shift+E` | Log out | FlickOS |
| `Super+T` | Window tiling on/off; more keys while it is on ([Window tiling](#window-tiling)) | FlickOS |
| `Print` / `Shift+Print` | Screenshot of region / whole screen → `~/Pictures/Screenshots` | FlickOS |
| Play/pause, stop, next, previous keys | `playerctl` (any MPRIS player: VLC, Firefox, …) | FlickOS |
| `Ctrl+Print` | Screenshot of region → clipboard | FlickOS |
| Volume / mic mute keys | `wpctl` (PipeWire) | FlickOS |
| Brightness keys | `brightnessctl` | FlickOS |
| `Alt+Tab` / `Alt+Shift+Tab` | Next / previous window | labwc |
| `Super+A` | Toggle maximize | labwc |
| `Alt+Arrows` | Move window to screen edge | labwc |
| `Super+Arrows` | Snap window to half the screen | labwc |
| `Alt+Space` | Window menu | labwc |

The full list of labwc defaults is in `man labwc-config` (section `<keyboard><default />`).

**Keep `<default />`.** Without it, defining any keybind turns off *all* of
labwc's built-in bindings: no Alt+Tab, no snapping.

### Adding or changing a binding

```xml
<keybind key="W-t"><action name="Execute"><command>mousepad</command></action></keybind>
```

- **Key format:** modifiers joined with `-`, then the key: `W-` Super, `A-` Alt,
  `C-` Ctrl, `S-` Shift. Examples: `W-S-Return`, `C-A-Delete`, `XF86AudioPlay`.
- **Find a key's name:** run `wev` (package `wev`) in a VM session, press the
  key and read the `sym:` field.
- **Shell syntax** (`&&`, `$(…)`) needs `sh -c '…'`, and `&` must be written
  `&amp;` in XML. See the screenshot bindings for examples.
- **Actions** other than `Execute` (e.g. `ToggleFullscreen`, `GoToDesktop`):
  `man labwc-actions`.
- **Test** in a VM: edit `/etc/xdg/labwc/rc.xml`, then *Settings → Reload Desktop
  Config*. When overriding a labwc default, check yours is the one that runs.

A user with `~/.config/labwc/rc.xml` gets none of FlickOS's bindings or theme
settings, because that file replaces the system one completely.

### Shortcut sheet (hold Super)

Holding Super on its own for 0.7 s shows the shortcuts until Super is let go
(package `flickos-shortcuts`, see [04](/docs/04-packages/#flickos-shortcuts)). The
sheet reads the rc.xml labwc uses, so a new binding shows up by itself. What it
says about a binding:

- **A command FlickOS knows** (`COMMANDS` in `flickos-shortcuts`: a regex on
  the command, a section and a description). Add a line there when you add a
  binding, or it shows as *Run PROGRAM* under *Other*.
- **A labwc action** (`ACTIONS`): `Close`, `ToggleMaximize`, `SnapToEdge`, …
  Unknown actions show their name (`ToggleDecorations` → *Toggle decorations*).
- Keys with the same description share a row; `XF86…` keys are left out.

Try it without building: `flickos-shortcuts list` prints what the sheet shows
(`--file` for another rc.xml). The hold time is `HOLD_MS`, the look
`usr/share/flickos/shortcuts/style.css` (the GTK theme's named colors only, so the Light style recolors it).

It can't tell a long press of Super alone from Super held while pressing
other keys (labwc sends it only the modifiers), so holding Super through
several shortcuts (Super+J, J, J with tiling) also shows the sheet. It lets
keys and clicks through, so this only costs the view.

---

## Program defaults

Where each program's FlickOS defaults live, all in `packages/flickos-settings/`.
The **method** depends on where the program looks for config and whether
Debian already ships a file there.

| Program | File | Method | Reference |
|---|---|---|---|
| labwc | `etc/xdg/labwc/rc.xml`, `menu.xml`, `autostart`, `environment` | Direct: no Debian file there | `man labwc-config` |
| foot | `etc/xdg/flickos/foot/foot.ini` | `XDG_CONFIG_DIRS`; included by the [style](#styles-darklight) overlay | `man foot.ini` |
| fuzzel | `etc/xdg/flickos/fuzzel/fuzzel.ini` | `XDG_CONFIG_DIRS`; included by the style overlay | `man fuzzel.ini` |
| Default apps | `etc/xdg/flickos/mimeapps.list` | `XDG_CONFIG_DIRS` | [Default apps](#b-which-app-opens-which-file-type) |
| pcmanfm | `etc/xdg/flickos/pcmanfm/default/pcmanfm.conf` | `XDG_CONFIG_DIRS` | Debian's `/etc/xdg/pcmanfm/default/pcmanfm.conf` |
| Night light | `usr/libexec/flickos/night-light` | Script started from autostart (through `flickos-control night-light`) | `man wlsunset` |
| waybar | flickos-layouts: `usr/share/flickos/layouts/ID/`, `common/`, `styles/ID/waybar-colors.css` (fallback: flickos-settings' `usr/share/flickos/waybar/`) | Files generated in `$XDG_RUNTIME_DIR/flickos/waybar/`, paths passed by `flickos-layout panel` | [waybar](#waybar-panel), `man waybar`, `man waybar-styles` |
| mako | `usr/share/flickos/mako/config` | Included by `$XDG_RUNTIME_DIR/flickos/mako/config`, passed by `flickos-layout panel` | `man 5 mako` |
| GTK apps | `usr/share/glib-2.0/schemas/90_flickos-settings.gschema.override` | GSettings override | `man glib-compile-schemas` |
| Window borders, title bars, menus | `usr/share/themes/FlickOS-Arc-Dark/labwc/themerc`, selected in `rc.xml`; `FlickOS-Arc` for the Light style | labwc theme | `man labwc-theme` |
| Cursor in labwc | `etc/xdg/labwc/environment` | Direct | `man labwc-config` |
| Keyboard layout | `usr/bin/flickos-session` | Session script (flickos-greeter's `greeter` does the same for the login screen) | `man xkeyboard-config` |
| Login screen | flickos-greeter: `usr/share/flickos/greeter/gtkgreet.css` | `gtkgreet --style` | [Login screen](#login-screen), `man gtkgreet` |

### The Arc-Dark palette

FlickOS's look is **arc-theme's Arc-Dark**. GTK apps get it from the GTK theme;
everything GTK themes don't reach (panel, terminal, launcher, notifications,
window borders, lock screen, boot menus, boot splash, login screen, installer,
artwork) uses the same colors, written into their own config files:

| Role | Color | Used for |
|---|---|---|
| `wm_bg` | `#2f343f` | Title bars, panel, installer sidebar |
| `bg_color` | `#383c4a` | Terminal, launcher, notifications, menus, boot splash, lock screen |
| `base_color` | `#404552` | Hover and active highlights |
| `borders` | `#2b2e39` | Borders, progress-bar track, terminal black |
| `fg_color` | `#d3dae3` | Text |
| `wm_title` | `#cfdae7` at 80 % (50 % unfocused) | Window titles |
| `selected_bg_color` / `selected_fg_color` | `#5294e2` / `#ffffff` | Accent, selections (white on blue) |
| `warning_color` / `error_color` / `success_color` | `#f27835` / `#fc4138` / `#73d216` | Battery warning, critical notifications, terminal colors |
| `wm_icon_bg` | `#90939b` | Muted hints (boot menu help) |

The values come from arc-theme's compiled stylesheet
(`/usr/share/themes/Arc-Dark/gtk-3.0/gtk.gresource`, resource
`/org/gnome/arc-theme/gtk-main-dark.css`). To read them:
`gresource extract /usr/share/themes/Arc-Dark/gtk-3.0/gtk.gresource /org/gnome/arc-theme/gtk-main-dark.css | grep define-color`.

**`tools/check-palette.py`** lists every allowed color, including the terminal
colors, and checks all files that contain colors. `tools/build-iso.sh` runs it
before building and stops if a file uses a color outside the palette or the
labwc theme has an unknown key. When you change a color, change it in the file,
add it to the checker if it's new, and run `python3 tools/check-palette.py`.

The [Light style](#styles-darklight)'s files are checked against a second list
with **Arc**'s colors (`ARC_LIGHT`: `#f5f6f7` background, `#ffffff` content,
`#e7e8eb` title bars and panel, `#dcdfe3` borders, `#5c616c` text, `#525d76`
title text, same accent and warning colors) plus terminal colors: Arc's accent,
error, warning and success colors darkened until they are readable on the light
background (`FLICKOS_LIGHT_ADDITIONS`).
Regenerate the artwork afterwards with `tools/make-placeholder-art.sh`.

### foot (terminal)

`etc/xdg/flickos/foot/foot.ini`: font, padding, transparency and the 16-color palette.
Debian's `/etc/xdg/foot/foot.ini` lists every option (commented out). Check
syntax in a VM: `foot -c /etc/xdg/flickos/foot/foot.ini --check-config`.

- **Transparency:** `alpha=0.9` in `[colors]` (0.0 transparent – 1.0 opaque). The
  wallpaper shows through. labwc has no blur, so text over a busy wallpaper can
  be harder to read; raise the value if needed.
- **Colors:** Arc has no terminal colors. FlickOS uses colors from Arc-Dark's
  stylesheet where one fits (red = error, green = success, yellow = warning,
  blue = accent, cyan and the bright variants = colors Arc uses elsewhere).
  Only magenta, bright magenta and bright green are FlickOS additions.
- **Styles:** with the Light style, foot reads a generated file that includes
  this one, then `styles/light/foot.ini` from flickos-layouts
  ([Styles](#styles-darklight)). A color key added here must be added to every
  style's `foot.ini`.

### fuzzel (launcher)

`etc/xdg/flickos/fuzzel/fuzzel.ini`: font, size, icon theme (`Numix-Circle`),
colors (`RRGGBBAA`, where the last two digits are opacity; the background is
translucent) and border. The selected entry uses Arc's selection style: white
text on the accent blue. `keyboard-focus=on-demand` closes fuzzel when another
window takes the keyboard (a click on it), not only on Esc. A click on the
empty desktop closes it through the [desktop clicks](#desktop-clicks), and the
panel's launcher button and `Super+D` close it when it is open
(`pkill -x fuzzel || fuzzel`). With the Light style, `styles/light/fuzzel.ini`
overrides the colors and the icon theme (`Numix-Circle-Light`).

### pcmanfm (file manager)

`etc/xdg/flickos/pcmanfm/default/pcmanfm.conf` is a full copy of Debian's file
with a larger window (960×600), a wider side pane and `autorun=0` (no "what to
do with this media" dialog when a USB stick is inserted). pcmanfm uses the first
`pcmanfm.conf` it finds, so the file must stay complete. When Debian changes
theirs, merge the changes in.

Useful keys: `[ui]` `view_mode=` (0 icons, 1 compact, 2 details, 3 thumbnails),
`show_hidden=`, `win_width=`/`win_height=`. Test in a VM with no
`~/.config/pcmanfm` (pcmanfm creates it when you change settings in its GUI).

### waybar (panel)

waybar only looks in `~/.config/waybar/` and `/etc/xdg/waybar/`, and Debian owns
the latter. So `/usr/libexec/flickos/autostart` runs `flickos-layout panel`,
which generates the chosen [desktop layout](#desktop-layouts)'s panel in
`$XDG_RUNTIME_DIR/flickos/waybar/` and starts `waybar -c … -s …` with it, but
only when the user has no config of their own. **The panel is edited in the
layouts** (`packages/flickos-layouts/usr/share/flickos/layouts/`), not here.

`packages/flickos-settings/usr/share/flickos/waybar/config.jsonc` and `style.css`
are only the **fallback**: started if `flickos-layout` fails or isn't installed.
Keep them working, but they aren't what users normally see.

- **Style:** layout CSS uses named colors from the style's
  `usr/share/flickos/styles/ID/waybar-colors.css` (Arc's own names, e.g.
  `@wm_bg`, `@selected_bg_color`). Bars are translucent:
  `alpha(@wm_bg, 0.85)` in `common/base.css`; raise the value towards `1.0` for
  solid bars.
- **Keep `"tray"`** in exactly one bar per layout: nm-applet and blueman live
  there. The unit tests enforce it.
- **Status icons:** volume and battery are icon-only (value in the tooltip);
  `common/base.css` draws symbolic icons from the icon theme with
  `-gtk-icontheme("NAME-symbolic")` per CSS class (`.muted`, `.warning`,
  `.charging`, ...). There is no waybar network module: nm-applet in the tray
  shows the connection and has the Wi-Fi menu.
- **Clicks:** volume opens pavucontrol, the launcher opens fuzzel
  (`common/modules.jsonc`).
- **Modules:** `man waybar-wlr-taskbar`, `man waybar-clock`, `man waybar-custom`,
  `man waybar-wireplumber`, `man waybar-battery`,
  `man waybar-tray`. Every module has its own page.
- **Test in a VM:** `flickos-layout set ID` regenerates and restarts the panel.
  To see waybar's own errors (JSON or CSS syntax), run it in a terminal:
  `pkill waybar; waybar -c $XDG_RUNTIME_DIR/flickos/waybar/config.jsonc -s $XDG_RUNTIME_DIR/flickos/waybar/style.css`.
  In a normal session waybar runs
  [supervised](#keeping-the-panel-running) and everything it prints is in
  `$XDG_RUNTIME_DIR/flickos/panel.log`.

### mako (notifications)

mako only reads `~/.config/mako/config`, so it follows the same pattern as
waybar: `flickos-layout panel` starts
`mako -c $XDG_RUNTIME_DIR/flickos/mako/config`, a generated file that includes
`usr/share/flickos/mako/config` (font, size, timeouts, Arc-Dark colors) and then
the style's `mako.conf` (colors only). If that fails, it starts
`mako -c /usr/share/flickos/mako/config`. A user's own `~/.config/mako/config`
is used as is. mako runs under the same
[supervisor](#keeping-the-panel-running) as the panel, and logs to
`$XDG_RUNTIME_DIR/flickos/panel.log` with it. Critical notifications have a red border and never time out. Test in a VM: `notify-send "Hello" "FlickOS"`, or
`notify-send -u critical "Hello"`.

### GTK theme, icons, cursor, fonts, dark mode

GTK apps under Wayland read these from **GSettings**. FlickOS sets defaults with
the schema override file. glib's package trigger recompiles the schemas when the
package is installed.

Current: **`Arc-Dark`** + `prefer-dark`, **`Numix-Circle`** icons, Adwaita cursor
(size 24), DejaVu fonts at size 10, and the title bar buttons
`appmenu:minimize,maximize,close` (`org.gnome.desktop.wm.preferences
button-layout`) for windows that draw their own title bar. The schema's default
`appmenu:close` would give Firefox without *Title Bar* only a close button.
Layouts with `TitlebarLayout` change it ([GTK settings](#gtk-settings-and-nwg-look)).
These are the defaults for users who never
chose anything. The [Light style](#styles-darklight) switches theme, icons and
`color-scheme`, and users can pick anything in *Settings → Appearance*
([nwg-look](#gtk-settings-and-nwg-look)).

- **Packages:** `arc-theme` (Arc, Arc-Dark, Arc-Darker, Arc-Lighter for GTK 2/3/4)
  and `numix-icon-theme-circle` (Numix-Circle and Numix-Circle-Light, ~12,000 app
  icons; it depends on `numix-icon-theme`, ~71 MB together) are **Depends** of
  flickos-settings, because these defaults name them. The base `Numix` theme alone
  has no icons for apps like Firefox, VLC, LibreOffice or foot, so they would keep
  their original icons.
- **libadwaita apps ignore GTK themes** and always look like Adwaita. That's by
  design in libadwaita, not a FlickOS bug.
- **Theme names** must be installed: `ls /usr/share/themes /usr/share/icons`.
- **Check in a VM:** `gsettings get org.gnome.desktop.interface gtk-theme`
  and `… icon-theme`.
- **Users** change settings with `gsettings set …`. Those are stored per user and win.
- **Cursor:** also update `XCURSOR_THEME`/`XCURSOR_SIZE` in `etc/xdg/labwc/environment`,
  which labwc uses for its own cursor.
- **Other components:** changing the GTK theme alone leaves the panel, terminal,
  launcher, notifications and window borders in the style's colors. See
  [The Arc-Dark palette](#the-arc-dark-palette) and [Styles](#styles-darklight).

### Window decorations (labwc theme)

arc-theme has no labwc (or Openbox) theme, so FlickOS ships its own:
**`FlickOS-Arc-Dark`** in `packages/flickos-settings/usr/share/themes/FlickOS-Arc-Dark/labwc/themerc`,
selected with `<name>FlickOS-Arc-Dark</name>` inside `<theme>` in `rc.xml`, plus
rounded corners (`<cornerRadius>`). **`FlickOS-Arc`** (`usr/share/themes/FlickOS-Arc/`)
is the same theme in Arc's light colors; the Light style selects it through the
`rc.xml` overlay. Both files must have the same keys (`tools/check-palette.py`).

It sets the title bars (Arc's `wm_bg`), title text (80 % / 50 % alpha, written
`#cfdae7cc`), button icon colors, borders, the root and window menus (Arc's
white-on-blue selection), the Alt+Tab switcher and the window-snapping preview.

- **Colors:** `#rrggbb` or `#rrggbbaa` (alpha in hex: `cc` = 80 %, `80` =
  50 %). Openbox's `#rrggbb <alpha percent>` still works in labwc 0.8.3 but is
  logged as deprecated at every start, so `tools/check-palette.py` rejects it.
- **Keys:** only those listed in `man labwc-theme`. A misspelled key is silently
  ignored by labwc, so `tools/check-palette.py` checks every key against the list
  for labwc 0.8.3. When labwc gains keys in a newer version, add them there.
- **labwc looks for themes** in `/usr/share/themes/<name>/labwc/` (and `openbox-3/`),
  plus the users' `~/.local/share/themes` and `~/.themes`.
- **Test in a VM:** edit `/usr/share/themes/FlickOS-Arc-Dark/labwc/themerc`, then
  *Settings → Reload Desktop Config*.

### Night light

`usr/libexec/flickos/night-light` looks up the system time zone
(`timedatectl`), finds that zone's coordinates in
`/usr/share/zoneinfo/zone1970.tab` and starts `wlsunset -l LAT -L LON`. The
coordinates are those of the zone's reference city, e.g. Berlin for
`Europe/Berlin`, which is accurate enough for sunset times. Nothing is looked
up online.

autostart runs it through `flickos-control night-light`, which adds `-t`
for the warmth chosen in *Settings → Displays* and doesn't run it at all
while night light is off there; the script passes its options on to wlsunset.

- **Change the fallback times** (used when there is no time zone): the
  `-S 06:30 -s 18:30` line.
- **Change the default warmth or turn it off for everyone:**
  `/etc/xdg/flickos/night-light.conf` (`Temperature=`, 2500–6000 K, and
  `Enabled=`); users' own choices win. The day temperature (`-T`, 6500 K)
  can be added in the script.
- **Users** who want exact coordinates put `pkill wlsunset; wlsunset -l LAT -L LON &`
  in their own `~/.config/labwc/autostart` (after calling the FlickOS script).
- **Test the lookup** on any machine: `sh usr/libexec/flickos/night-light` with a
  fake `wlsunset` that prints its arguments, or read `pgrep -a wlsunset` in a VM.

### Keyboard layout

labwc doesn't read the system keyboard setting, so the session script
(`flickos-session`, and the login screen's `greeter` for cage) copies
`/etc/default/keyboard` into `XKB_DEFAULT_LAYOUT`, `XKB_DEFAULT_VARIANT`,
`XKB_DEFAULT_MODEL` and `XKB_DEFAULT_OPTIONS`. That file is written by Calamares
(the installer's keyboard page) and by live-config (the `keyboard-layouts=` boot
option).

- **Test:** at the ISO boot menu, add `keyboard-layouts=de` to the kernel line
  and type in foot. Or choose a different layout in Calamares and check the
  installed system.
- **Users** override the layout in `~/.config/labwc/environment`, e.g.
  `XKB_DEFAULT_LAYOUT=us,de` and `XKB_DEFAULT_OPTIONS=grp:alt_shift_toggle`.

---

## Installer

`packages/flickos-installer/` replaces Debian's `calamares-settings-debian`
(it `Conflicts:`, `Replaces:` and `Provides: calamares-settings`). It's installed
through `config/package-lists/installer.list.chroot`.

| Path | Purpose |
|---|---|
| `etc/calamares/settings.conf` | Installer page and job sequence. `branding: flickos` |
| `etc/calamares/modules/*.conf` | Per-module config, copied from Debian. `packages.conf` removes live-only packages, `calamares` and `flickos-installer` from the installed system. `welcome.conf` turns on the support, known issues and release notes links |
| `etc/calamares/branding/flickos/` | `branding.desc` (names, colors, images), `show.qml` (slideshow during install), `logo.png`, `welcome.png` |
| `usr/lib/calamares/modules/`, `usr/share/calamares/helpers/` | Debian's helper jobs: GRUB install, apt sources, faster dpkg. Unchanged copies |
| `usr/bin/flickos-install` | Launcher: runs `sudo -E calamares` so it opens on the Wayland desktop |
| `usr/share/applications/flickos-install.desktop` | *Install FlickOS* in the app launcher |
| `etc/xdg/flickos-live/labwc/menu.xml` | Live-session menu with *Install FlickOS* |

**How the install entry disappears after installation:** Calamares copies the
live system, then its `packages` module removes `flickos-installer`. That deletes
`/etc/xdg/flickos-live`, so the session script no longer adds it, and labwc
falls back to the normal menu.

**Common changes:**

- **Name, version, colors:** `branding.desc`, under `strings:` and `style:`.
  Update the four version strings for each release, to match `FLICKOS_VERSION`
  ([06 – The version number](/docs/06-ci-and-releases/#the-version-number)).
  `tools/build-iso.sh` refuses to build if `version` doesn't match.
- **Links on the welcome page:** `productUrl`, `supportUrl`, `knownIssuesUrl`,
  `releaseNotesUrl` in `branding.desc`. Currently the SourceForge project, GitHub
  issues and the SourceForge Files page. Switch `productUrl` to https://flickos.net
  once the website is online. To hide a link, set its `show…Url` to `false` in
  `modules/welcome.conf`.
- **Slideshow text:** `show.qml`. Every `Slide { … }` is one slide.
- **Installer images:** see [Artwork](#artwork).
- **Minimum disk/RAM:** `requiredStorage` / `requiredRam` in `modules/welcome.conf`.
- **Groups for new users:** `defaultGroups` in `modules/users.conf`. It already
  includes `sudo`, `lpadmin` (printers) and `bluetooth`.

**When Debian updates `calamares-settings-debian`:** compare its files with your
copies. Download it with `apt-get download calamares-settings-debian` and
unpack it with `dpkg -x`, especially `usr/share/calamares/helpers/` and
`settings.conf`. Merge the relevant fixes, bump the version and rebuild.

**Test the installer:** `tools/test-iso.sh --reset --install` ([02](/docs/02-building-and-testing/#manual-testing-toolstest-isosh)).
Calamares writes its log to `.cache/calamares/session.log` in the home directory
of the user it runs as. Because of `sudo -E`, look in both `/home/user/` and `/root/`.
For more detail, start it from a terminal with `flickos-install -d`.

---

## Boot menu

The ISO's boot menu (syslinux for BIOS, GRUB for UEFI) is customized through
**`config/bootloaders/`**. live-build copies its own templates first
(`/usr/share/live/build/bootloaders/`), then copies FlickOS's files **over** them,
so only changed files live in the repo.

| File | Bootloader | What FlickOS changes |
|---|---|---|
| `syslinux_common/splash.png` | BIOS | Background image, 640×480, 8-bit RGB PNG |
| `syslinux_common/live.cfg.in` | BIOS | Entry names: *Start FlickOS*, *Start FlickOS (safe mode)* |
| `syslinux_common/menu.cfg` | BIOS | Menu title |
| `syslinux_common/stdmenu.cfg` | BIOS | Arc-Dark colors (`#AARRGGBB`; selection is white on the accent blue), menu position below the logo |
| `isolinux/isolinux.cfg` | BIOS | `timeout 100`: boot automatically after 10 s |
| `grub-pc/splash.png` | UEFI | Background image, 800×600, 8-bit RGB PNG |
| `grub-pc/grub.cfg` | UEFI | Own entries (*Start FlickOS*, safe mode), `set timeout=10` |
| `grub-pc/live-theme/theme.txt` | UEFI | Arc-Dark colors, no title text (the splash shows the name), menu position |

The safe mode entries use `--bootappend-live-failsafe` from `auto/config`.

**Placeholders.** live-build fills in `@…@` markers when it builds the ISO:
`@LINUX@`, `@INITRD@`, `@APPEND_LIVE@`, `@APPEND_LIVE_FAILSAFE@` (syslinux) and
`@KERNEL_LIVE@`, `@INITRD_LIVE@`, `@APPEND_LIVE@`, `@LB_BOOTAPPEND_LIVE_FAILSAFE@` (GRUB).
`@TIMEOUT_NOTIFICATION_LONG@` and `@KEYMAP_SHORT@` in `theme.txt` are filled in by GRUB itself.

**Trap in `grub.cfg`:** for backwards compatibility live-build also replaces the
**bare words** `KERNEL_LIVE`, `INITRD_LIVE`, `APPEND_LIVE`, `MEMTEST`,
`LINUX_LIVE` and similar anywhere in GRUB `.cfg` files, including comments. A
line containing `LINUX_LIVE` is deleted entirely. Never write those words
outside `@…@` markers.

**Common changes:**
- **Rename entries:** `menu label` lines in `live.cfg.in` (the `^` marks the
  hotkey letter) and `menuentry "…"` in `grub.cfg`. Keep them in sync.
- **Timeout:** `timeout` in `isolinux.cfg` (tenths of a second, `0` = wait
  forever), `set timeout=` in `grub.cfg` (seconds, `-1` = wait forever).
- **Add a boot option entry** (e.g. with `nomodeset` for broken graphics), GRUB:
  ```
  menuentry "Start FlickOS (basic graphics)" {
  	linux	@KERNEL_LIVE@ @APPEND_LIVE@ nomodeset
  	initrd	@INITRD_LIVE@
  }
  ```
  syslinux: add a `label` block to `live.cfg.in` with `append @APPEND_LIVE@ nomodeset`.
- **Images:** replace the two `splash.png` files, same sizes, **8 bits per
  channel, no transparency** (GRUB can't read 16-bit PNGs). Check with
  `identify splash.png` (ImageMagick): it must say `8-bit`.

**Test:** `tools/build-iso.sh`, then `tools/test-iso.sh --bios` (syslinux) and
`tools/test-iso.sh --uefi` (GRUB). The headless boot test skips the boot menu.
It reads the first entry's kernel line from `isolinux/live.cfg`, so keep the
`linux` / `initrd` / `append` structure of the first entry.

---

## Boot splash

`flickos-branding` installs a **Plymouth** theme at
`/usr/share/plymouth/themes/flickos/` and makes it the default the first time it's
installed. Plymouth shows it from early boot until the login prompt, and at shutdown.

| File | Purpose |
|---|---|
| `flickos.plymouth` | Theme definition. Module `two-step` (logo + spinner), colors, positions. That module comes from the **plymouth-themes** package, which is why `flickos-branding` depends on it: without it `plymouth-set-default-theme` fails and the ISO build stops |
| `watermark.png` | Logo in the middle of the screen |
| `throbber-0001.png` … `0030.png` | Spinner animation while booting |
| `animation-0001.png` … `0030.png` | End animation, required by `two-step` even though it's turned off |
| `entry.png`, `bullet.png`, `lock.png` | Password dialog for encrypted disks |

**How it gets on screen:** the kernel line must contain `splash`.
- **Live ISO:** `--bootappend-live` in `auto/config` has `quiet splash`.
- **Installed systems:** Calamares's `grubcfg` job adds `splash` to
  `GRUB_CMDLINE_LINUX_DEFAULT` automatically when Plymouth is installed.

The theme lives inside the **initramfs**, so the package triggers
`update-initramfs` when it's installed or upgraded.

**Common changes:**
- **Colors:** `BackgroundStartColor`/`BackgroundEndColor` (`0xRRGGBB`, same
  value = solid color; Arc-Dark `0x383c4a`) and the progress bar colors in
  `flickos.plymouth`. Keep them in the [Arc-Dark palette](#the-arc-dark-palette).
- **Positions:** `WatermarkVerticalAlignment` (logo) and `VerticalAlignment`
  (spinner). `0` = top, `1` = bottom.
- **Images:** replace the PNGs, keeping the names. The spinner frames can be any
  size and any number of frames, numbered from `0001`.

**Test without rebooting**, in a VM or on an installed system:
```sh
sudo plymouthd; sudo plymouth show-splash; sleep 5; sudo plymouth quit
```
Run it from a text console (Ctrl+Alt+F2), not inside labwc. To test at boot,
remove `quiet` temporarily at the boot menu to see errors. `plymouth-set-default-theme`
without arguments prints the active theme.

**Encrypted installs:** `two-step` shows the disk password prompt using
`entry.png`, `bullet.png` and `lock.png`. Test it once with an encrypted
install (`tools/test-iso.sh --reset --install`, then tick *Encrypt system* in
Calamares).

---

## OS name and login banner

`flickos-branding` makes FlickOS visible where Linux shows the OS name, **without
pretending not to be Debian**:

| File | Content | Seen in |
|---|---|---|
| `/etc/os-release` (→ `/usr/lib/os-release`) | Debian's file with `PRETTY_NAME="FlickOS 2.0 (based on Debian GNU/Linux 13 (trixie))"`, `VARIANT="FlickOS 2.0"`, `VARIANT_ID=flickos` added. **`ID=debian`, `NAME`, `VERSION_ID` etc. unchanged** | `hostnamectl`, system info tools (e.g. fastfetch), "About" dialogs that read `os-release` |
| `/etc/issue` | `FlickOS 2.0 (Debian 13) \n \l` | Text console login prompt |
| `/etc/issue.net` | `FlickOS 2.0 (Debian 13)` | Network login banners |

`ID=debian` stays because installers, package managers and many scripts check it
to decide how to behave. Changing it breaks them.

**How it works.** These files belong to Debian's `base-files` package. Overwriting
them directly would break on the next `base-files` upgrade. Instead,
`debian/flickos-branding.postinst`:

1. **Diverts** each file with `dpkg-divert --no-rename`, so future `base-files`
   upgrades write their version to `FILE.debian` (e.g.
   `/usr/lib/os-release.debian`) instead of the real path, and copies Debian's
   current version there itself. `--no-rename` is used because dpkg-divert warns
   that renaming files of an Essential package (`base-files`) is dangerous.
2. **Generates** the FlickOS version from `FILE.debian` plus
   `/usr/lib/flickos-release`.
3. Declares **file triggers** (`debian/flickos-branding.triggers`) on the
   `.debian` files. When `base-files` updates them (e.g. Debian 13.8), dpkg runs
   the postinst again with `triggered`, and the FlickOS versions are regenerated.

Removing the package (`postrm`) deletes the generated files and removes the
diversions, which restores Debian's originals.

**Change the version or name:** edit `packages/flickos-branding/usr/lib/flickos-release`
(`FLICKOS_NAME`, `FLICKOS_VERSION`), bump the package version and rebuild. Do this
for every FlickOS release, together with the version strings in the installer's
`branding.desc`. The ISO name and volume label follow automatically
([06 – The version number](/docs/06-ci-and-releases/#the-version-number)).

**Change the text layout:** the `generate_files` function in
`debian/flickos-branding.postinst`. Test it without installing anything: copy
Debian's `os-release` and `issue` to a temporary folder, run the function with
paths pointing there, and inspect the output.

**Check on a system:**
```sh
cat /etc/os-release; cat /etc/issue
dpkg-divert --list flickos-branding     # the three diversions
```

---

## Firewall

The ISO ships with **ufw** turned on (`config/hooks/normal/0200-firewall.hook.chroot`
sets `ENABLED=yes` in `/etc/ufw/ufw.conf`, and the matching debconf answer). ufw's
defaults:

| Direction | Policy |
|---|---|
| Incoming | **Blocked**, except replies to connections this computer started, DHCP, and mDNS/UPnP discovery (`/etc/ufw/before.rules`), so printers and media servers on the network are still found |
| Outgoing | Allowed |
| Forwarded | Blocked |

Because the hook runs at build time, the firewall is on for the live session and
all installed systems. Existing systems that only receive `ufw` through
`apt upgrade` keep it off, which is ufw's own default.

**Users** turn it on or off on the *Firewall* page of the Settings window
([Settings window](#settings-window); administrator password). Rules need a
terminal:
```sh
sudo ufw status verbose
sudo ufw allow 22/tcp          # e.g. allow SSH
sudo ufw allow from 192.168.1.0/24
sudo ufw disable               # turn off
```

**Change the defaults for FlickOS:** `ufw allow` and similar commands can't run in
the build chroot, because they need the kernel's firewall. Instead, either:
- edit the policies in the hook with `sed` on `/etc/default/ufw`
  (`DEFAULT_INPUT_POLICY` etc.), or
- ship pre-made rule files in a package (`/etc/ufw/user.rules`,
  `/etc/ufw/user6.rules`). Generate them on a test VM with `ufw allow …`, then
  copy them out.

**Turn the firewall off by default:** delete the hook. ufw stays installed but disabled.

**Test:** the boot test checks `ufw status` (check *firewall active*). In a VM,
`sudo ufw status verbose` should show `Status: active` and `deny (incoming)`.

---

## Artwork

**The logo** is vector art in `flickos-branding`, in the [Arc-Dark palette](#the-arc-dark-palette):

| File | Used by |
|---|---|
| `packages/flickos-branding/usr/share/icons/hicolor/scalable/apps/flickos.svg` | Icon `flickos`: full color on an Arc-Dark tile. **The source** of every logo image below |
| `packages/flickos-branding/usr/share/icons/hicolor/symbolic/apps/flickos-symbolic.svg` | Icon `flickos-symbolic`: one color (GTK draws it in the text color). The panel's launcher button (`-gtk-icontheme("flickos-symbolic")` in the layouts' `common/base.css`, hover in the accent color) |

Keep the two drawings in sync, and only use palette colors (`tools/check-palette.py`
checks both files). The symbolic version has no speed lines and a gap between ring
and wing, so it stays readable at 16–20 px.

The images are made by `tools/make-placeholder-art.sh` (ImageMagick, with the logo
rendered from `flickos.svg` by `rsvg-convert`). Everything except the logo is still a
**placeholder**, except `default.jpg`, which has been replaced by an Unsplash
photo (see flickos-settings' `debian/copyright`). The script would overwrite it
with the placeholder, so restore it with `git checkout` after running the script:

| File | Size | Used by |
|---|---|---|
| `packages/flickos-settings/usr/share/backgrounds/flickos/default.jpg` | 3840×2160 | Wallpaper |
| `packages/flickos-installer/etc/calamares/branding/flickos/logo.png` | 256×256 | Calamares sidebar and window icon, slideshow |
| `packages/flickos-installer/etc/calamares/branding/flickos/welcome.png` | 457×300 | Calamares welcome page |
| `packages/flickos-installer/usr/share/pixmaps/flickos-install.png` | 256×256 | *Install FlickOS* launcher icon |
| `config/bootloaders/syslinux_common/splash.png` | 640×480 | BIOS boot menu background |
| `config/bootloaders/grub-pc/splash.png` | 800×600 | UEFI boot menu background |
| `packages/flickos-branding/usr/share/plymouth/themes/flickos/*.png` | various | Boot splash: logo, spinner frames, password dialog |

The desktop layout previews
(`packages/flickos-layouts/usr/share/flickos/layouts/ID/preview.png`, 240×150)
come from a separate script, `tools/make-layout-previews.sh`. See
[The chooser](#the-chooser).

**Replace them** by overwriting the files at the same size, then bump the
package versions. Artwork you didn't make yourself needs a `Files:` stanza with its
author and license in the package's `debian/copyright`. Once you have real artwork, stop running the script, or delete
it, so it doesn't overwrite your files. To regenerate them (e.g.
after changing the logo or the palette):
`sudo apt install imagemagick librsvg2-bin && tools/make-placeholder-art.sh`.

---

## Ideas for later

| Idea | Why it isn't done | Where it would go |
|---|---|---|
| **Real artwork** | Needs a designer | Replace the files listed under [Artwork](#artwork) |
| **Firewall GUI** | `gufw` pulls in a large Python/GTK stack | `gufw` in `flickos-desktop` Recommends, plus a *Settings → Firewall* menu entry |
| **Welcome app on first login** | Needs to be written | A small script or app in `flickos-settings`, started once from `/usr/libexec/flickos/autostart` (check for a marker file in `~/.config/flickos/`) |
| **Automatic app updates for Flatpak** | Policy decision (bandwidth, surprise updates) | A systemd user timer running `flatpak update --noninteractive` in `flickos-settings` |
| **Exact night light location** | Would need network geolocation (privacy) | `geoclue-2.0` + a location-aware tool instead of the time-zone lookup |

For each one you adopt: packages go in `flickos-desktop`
([04](/docs/04-packages/#adding-or-removing-a-desktop-package)), config files in
`flickos-settings` (this page), services and system setup in hooks
([03](/docs/03-live-build-config/#confighooksnormal-scripts-run-during-the-build)),
and add a check to the boot test where it makes sense
([02](/docs/02-building-and-testing/#adding-a-check)).
