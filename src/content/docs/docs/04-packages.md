---
title: FlickOS packages
description: "FlickOS's own packages live in `packages/`. Each is a **native Debian source"
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
  `flickos-archive-keyring`, …).
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
| `usr/bin/flickos-session` | `/usr/bin/` | Starts the session: config directories, desktop layout overlay (`flickos-layout prepare`), keyboard layout, `exec labwc`. Run by the login screen and by the tty1 script |
| `etc/profile.d/95-flickos-session.sh` | `/etc/profile.d/` | On tty1 login (live autologin, text login) runs `flickos-session` |
| `usr/share/wayland-sessions/flickos.desktop` | same | The session for other display managers |
| `etc/xdg/labwc/rc.xml`, `menu.xml`, `environment` | `/etc/xdg/labwc/` | Keybindings, root menu, cursor |
| `etc/xdg/labwc/autostart` | `/etc/xdg/labwc/` | Calls `/usr/libexec/flickos/autostart` |
| `usr/libexec/flickos/autostart` | `/usr/libexec/flickos/` | Starts wallpaper (`flickos-layout wallpaper`), panel (`flickos-layout panel`), notifications, applets, idle lock |
| `etc/xdg/flickos/` | `/etc/xdg/flickos/` | foot, fuzzel and default-app (`mimeapps.list`) config |
| `usr/share/flickos/` | `/usr/share/flickos/` | waybar and mako config |
| `usr/share/backgrounds/flickos/default.jpg` | same | Wallpaper for layouts without their own, and without flickos-layouts |
| `usr/share/glib-2.0/schemas/90_flickos-settings.gschema.override` | same | GTK theme (Arc-Dark), icons (Numix-Circle), fonts, dark mode |
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
| `usr/bin/flickos-layout` | `/usr/bin/` | Python 3 tool: `list`, `current`, `set`, `style list/current/set`, `clicks list/current/set`, `prepare`, `panel`, `wallpaper`, `doctor`, `pick` (chooser), `first-run` |
| `usr/share/flickos/layouts/ID/` | same | One folder per layout (`redmond`, `cupertino`, `traditional`): `layout.ini`, `waybar.jsonc`, `style.css`, `preview.png`, `wallpaper.jpg` |
| `debian/links` | `/usr/share/backgrounds/flickos/ID.jpg` | Links to the layouts' wallpapers, for waypaper |
| `usr/share/flickos/layouts/common/` | same | `modules.jsonc` and `base.css`, shared by every layout |
| `usr/share/flickos/styles/ID/` | same | One folder per style (`dark`, `light`): `style.ini` (GTK, icon and labwc theme names) and the palettes `waybar-colors.css`, `foot.ini`, `fuzzel.ini`, `mako.conf` |
| `etc/xdg/flickos/layouts.conf` | same | Default layout, style and desktop clicks (conffile) |
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
- **License:** GPL-3+ (`debian/copyright`), unlike FlickOS's own files.

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
- **A Depends of `flickos-desktop`** and in the sanity hook's `REQUIRED`.
- **Unit tests** in `tests/` (arrangements, window bookkeeping, fragment, the
  Wayland client against a fake compositor), run at package build like
  flickos-layouts'.

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
    ├── install               "source-path   destination-dir/" lines
    ├── rules                 build script. `dh $@` handles everything
    └── source/format         "3.0 (native)"
```

| File | Notes |
|---|---|
| `control` | First stanza = source package, then one stanza per binary package. Lines starting with `#` are comments. Use `Architecture: all` for anything without compiled code. `${misc:Depends}` must stay |
| `changelog` | Strict format, so edit with `dch`, not by hand. The version and distribution come from the top entry |
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
3. `debian/changelog`: `dch --create --package flickos-wallpapers -v 1.0 -D trixie "Initial release."`
4. Build: `sh packages/build.sh`.
5. Make something pull it in, e.g. add `flickos-wallpapers` to
   `flickos-desktop`'s `Depends:` (or `Recommends:`) and bump that package's version too.
6. Publish both. See [05](/docs/05-apt-repository/).

## Checking quality with lintian (optional)

`lintian` reports packaging mistakes:

```sh
sudo apt install lintian
lintian config/packages.chroot/flickos-settings_*.deb
```

Warnings like missing `debian/copyright` or `no-manual-page` are expected for
small distro packages. Errors (`E:`) are worth fixing.
