---
title: Visual style
description: "FlickOS looks like one thing: arc-theme's Arc-Dark by default, Arc in the Light style, Numix-Circle icons, the system font. A FlickOS program gets almost…"
sidebar:
  order: 6
---
FlickOS looks like one thing: arc-theme's Arc-Dark by default, Arc in the Light
style, Numix-Circle icons, the system font. A FlickOS program gets almost all
of that for free by *not* styling itself.

The palette itself, with every color's role, is in
[09 – Customizing: The Arc-Dark palette](/docs/09-customizing/#the-arc-dark-palette).

## Color

### VIS-1 Must: Only the palette's colors

Every color in a FlickOS file is one of arc-theme's colors: Arc-Dark's, or
Arc's for the Light style's own files. `tools/check-palette.py` holds both
lists and checks every file that contains colors, and `build-iso.sh` stops on
a color that isn't in them.

A new color is a design decision: add it to the checker deliberately, with the
arc-theme role it comes from, in the same commit.

### VIS-2 Must: Follow the style that is in use

The user picks Dark or Light in *Settings → Desktop Layout & Style*, and every
FlickOS surface follows at once. How depends on what draws it:

| Surface | How it follows the style | Example |
|---|---|---|
| A GTK window | The GTK theme. No CSS at all | Settings, Welcome, the layout chooser |
| A GTK surface that needs CSS (layer shell, custom widgets) | CSS that uses only the theme's named colors: `@theme_bg_color`, `@theme_fg_color`, `@theme_base_color`, `@theme_selected_bg_color`, `@borders`, `alpha(@…, 0.25)` | The start menu |
| The panel | The layout's CSS uses only named colors, defined by the style's `waybar-colors.css` | Every layout |
| foot, fuzzel, mako | The style's palette file, `include=`d after the base config | `styles/light/foot.ini` |

**Stays Arc-Dark in every style:** the boot menus, the boot splash, the
installer and the login screen, because they show before any user has picked a
style. Also the lock screen's plain color and the color around a wallpaper
that doesn't fill the screen (`SWAYLOCK`, `WALLPAPER_COLOR`), which frame
pictures rather than hold text. These are the only places a FlickOS file
hard-codes Arc-Dark hex colors for something the user sees.

**Don't:** write `#2f343f` into a new program's CSS. It is right in Dark and
wrong in Light.

### VIS-3 Must: Never pick dark or light yourself

Don't set `gtk-application-prefer-dark-theme`, load a theme, or choose colors
by testing which style is on. The user's style (and any GTK theme they chose
in *Appearance*) decides.

## Shape

### VIS-4 Should: No CSS unless there is no other way

A normal GTK window has no CSS of its own. The Arc theme already styles buttons,
lists, entries and headings, and any CSS is something that can clash with a
theme the user picks later. Use style classes the theme knows instead:
`dim-label` for secondary text, `suggested-action` and `destructive-action` for
buttons.

When CSS is needed (a layer-shell surface has no window frame to inherit):

- ship it as `/usr/share/flickos/NAME/style.css`,
- scope every selector under a class named after the program
  (`.flickos-menu .app`), so it can't leak into anything else,
- load it with `STYLE_PROVIDER_PRIORITY_APPLICATION`, so a user's
  `gtk.css` still wins,
- style your own classes, and don't restyle the theme's widgets.

### VIS-5 Should: Keep it flat and still

FlickOS draws translucency without blur (panel, terminal) and no shadows,
animations or transitions of its own beyond GTK's. They cost frames on old
graphics hardware and add nothing to finding things. Stack transitions are
`NONE`.

## Icons

### VIS-6 Must: Icons come from the icon theme, by standard name

- Use [freedesktop icon names](https://specifications.freedesktop.org/icon-naming-spec/latest/)
  (`preferences-system`, `system-shutdown`), which Numix-Circle and
  Numix-Circle-Light both have. Never ship a PNG for something the theme
  already draws.
- When a name may be missing (a theme the user chose), try several and use the
  **first one the theme has**: `next(n for n in names if theme.has_icon(n))`.
  Don't pass a list to `Gio.ThemedIcon.new_from_names()`: GTK 3 tries every
  name in one theme before the next, so a poor fallback can win.
- FlickOS's own logo is the icon `flickos`.
- Small buttons inside a row use `-symbolic` icons (`list-remove-symbolic`),
  which take the text color in both styles.

### VIS-7 Should: Icon sizes come from GTK

Use `Gtk.IconSize`: `BUTTON` (16) inside rows, `LARGE_TOOLBAR` (24) for icon
buttons, `DND` (32) for cards, `DIALOG` (48) for big tiles. Set a pixel size
only where a layout needs it (the start menu's full-screen grid).

## Text

### VIS-8 Must: The system font, relative sizes

Text uses the font the user set in *Appearance*. Don't set a font family,
except `monospace` for keys and code (the shortcut sheet's key caps). Make
text bigger or bolder with Pango markup (`<b>`, `size='x-large'`) or relative
CSS, not fixed sizes, so a larger system font makes everything larger
([A11Y-7](/docs/hig/07-accessibility/#a11y-7-must-layouts-survive-larger-text-and-scaling)).

Hierarchy is done with weight and dimming, not color: headings are bold,
secondary text has `dim-label`, and the accent color is kept for selection
and the suggested action.

## Artwork

### VIS-9 Must: Artwork is generated, and its source is recorded

- Layout previews come from `tools/make-layout-previews.sh`, the placeholder
  art (boot, splash, installer) from `tools/make-placeholder-art.sh`, both from
  the palette. Regenerate them when a layout or a color changes, and don't
  edit the images by hand.
- A picture from elsewhere (a wallpaper photo) has its own stanza in the
  package's `debian/copyright` with its author and license
  ([PKG-5](/docs/hig/09-packaging/#pkg-5-must-every-file-has-a-known-license)).
