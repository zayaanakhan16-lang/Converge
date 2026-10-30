# Design system

Converge is designed to feel like a considered tool rather than a social feed.
This document records the decisions that a new screen has to follow, and the
reasoning behind them, so the product stays coherent as it grows.

## Brand idea

Two people arrive from different directions and find something they share. The
mark is built from three paths converging on a single point of light: distinct,
unalike strokes that meet rather than a symbol that stands for "chat".

The exploration that led there is in `brand/guidelines/explorations/`:

| Direction | Idea | Why it was not chosen |
| --- | --- | --- |
| A — Rays | Paths fanning into a shared point | Too close to a signal broadcast at small sizes |
| B — Hub | Interconnected nodes around a centre | Read as a network diagram, not a human meeting |
| C — Focus | Two strokes crossing in negative space | Strong, but the crossing read as a letter X |

The chosen mark (C, refined) keeps the crossing but offsets the strokes so they
merge into one point instead of passing through each other. That single change is
what makes it read as convergence.

## Colour

The palette is deep teal on warm neutral. Teal carries the associations that
matter here — considered, calm, grown-up — without the coldness of a blue-grey
or the urgency of an orange accent.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| Primary | `#0E3A4C` | `#7FC4D4` | Brand surfaces, primary buttons |
| Secondary | `#1C6B7A` | `#5FA8BA` | Secondary actions, charts |
| Accent | `#0F7C8C` | `#4EC0CF` | Focus rings, active states |
| Background | `#F7F4EF` | `#0B1420` | Page background |
| Surface | `#FFFFFF` | `#152233` | Cards, sheets, inputs |
| Text primary | `#10232E` | `#F2F6F8` | Body copy, headings |
| Text secondary | `#4C6472` | `#9DB2C0` | Metadata, captions |
| Border | `#DCE3E7` | `#26374A` | Dividers, input outlines |
| Success | `#1F7A54` | `#4FBF8B` | Confirmed states |
| Warning | `#8A5A12` | `#E0B25C` | Caution, degraded features |
| Error | `#A32F35` | `#E8757B` | Failures, destructive actions |

`brand/guidelines/colour-tokens.json` is the machine-readable source. The mobile
theme in `mobile/src/theme/` mirrors it, and `mobile/src/context/ThemeContext.tsx`
selects the light or dark set from the system preference.

Every pair above was checked against WCAG AA: body text meets 4.5:1 against its
own background, and the accent colours meet 3:1 against the surface they sit on
to be usable for focus rings and borders. The dark set is not a naive inversion —
`#7FC4D4` on `#0B1420` is a lighter, desaturated teal, because the light-mode
primary would be too heavy on a dark surface.

## Typography

Two families, both with full Android support and no missing glyphs for the
supported languages:

- **Fraunces** (display, headings) — a serif with real personality at large sizes.
  Used only for the wordmark and screen titles, never for body copy: it is warm
  rather than neutral, which is the brand but tiring to read in volume.
- **Manrope** (body, buttons, labels, data) — a geometric sans with an even
  rhythm at small sizes and open counters, which matters for the many short
  labels in this product.

| Role | Family | Size / weight | Line height |
| --- | --- | --- | --- |
| Display | Fraunces SemiBold | 32 / 600 | 38 |
| Heading | Fraunces SemiBold | 24 / 600 | 30 |
| Title | Manrope SemiBold | 18 / 600 | 24 |
| Body | Manrope Regular | 16 / 400 | 24 |
| Body strong | Manrope Medium | 16 / 500 | 24 |
| Caption | Manrope Regular | 13 / 400 | 18 |
| Button | Manrope SemiBold | 15 / 600 | 20 |
| Label | Manrope Medium | 13 / 500 | 18 |

Fonts are loaded once by `mobile/src/hooks/useBrandFonts.ts` and referenced by
token from `mobile/src/theme/`, so a screen never names a font file. The specimen is in
`brand/typography/typography-specimen.svg`.

## Space, radius and elevation

Spacing is a 4px scale (`xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `xxl` 32). Any
value not on the scale is a mistake.

Radius is restrained: `sm` 8 for inputs and chips, `md` 12 for cards, `lg` 20 for
sheets and the primary button. Nothing is fully rounded except avatars and status
pills, because a screen of pill-shaped cards reads as a toy.

Elevation is used once per screen at most. Depth comes from the surface/border
contrast instead, which survives a dark theme far better than shadows.

## Screens and states

Every data screen is built from the same four states, and every one of them is
designed rather than left to chance:

- **Loading** — a skeleton that matches the shape of the real content, so the
  layout does not jump when data arrives.
- **Empty** — a short explanation of what would appear here and the single action
  that would fill it. Never a bare illustration.
- **Error** — what failed, whether it is worth retrying, and a retry control.
  `RepositoryError` carries a `code` (`not-authenticated`, `not-permitted`,
  `not-found`, `conflict`, `validation`, `network`, `unknown`) and the screen
  chooses copy from that, so the same failure reads the same way everywhere.
- **Content** — the real thing.

`mobile/src/components/ui/` holds these primitives: `Button`, `Chip` /
`ChipGroup`, `TextField`, `EmptyState` / `LoadingState`, `Text`, and from
`Layout.tsx` the `Screen`, `Card`, `SectionHeader` and `Divider` building blocks.
`Banners.tsx` carries inline notices. Screens compose them; they do not restyle
them.

## Navigation

A bottom tab bar with five destinations, ordered by the central journey:

```
Discover → Communities → Connections → Messages → Profile
```

Discover and Communities are browsing: people and groups, then places and events.
Connections is the consent gate, where requests are sent, answered and kept.
Messages is what opens once a connection is mutual. Profile is where control
lives. The conversation coach is a stack screen inside the Discover, Connections
and Messages stacks rather than a sixth tab, because it is practice you enter from
a person or a conversation rather than a place you go on its own.

Stack navigators sit inside each tab for depth (a community, an event, a
conversation, a member's profile), so the tab bar stays a stable anchor. Anything
that is a *decision* rather than a destination — sending a request, reporting,
blocking, deleting an account — is a modal or a sheet, and always states the
consequence before the confirm button.

## Motion

Animation is limited to three purposes, and nothing animates for decoration:

1. **Orientation** — screens push and fade so it is clear where you came from.
2. **Feedback** — a button press scales slightly, and haptics fire on the actions
   that matter (sending a request, accepting one).
3. **Progress** — skeletons shimmer, and the record button pulses while capturing.

Durations are 150–250ms with a standard ease-out. Anything slower feels sluggish
on a mid-range Android device, which is the target.

## Accessibility

- Contrast is checked against AA, in both themes, for every token pair in use.
- Every interactive element has an `accessibilityLabel`, and the labels describe
  the action rather than the icon ("Send connection request", not "paper plane").
- Touch targets are at least 48dp.
- Text scales with the system setting: sizes come from tokens, and no layout
  depends on text fitting on one line.
- The waveform component announces its state as text for a screen reader, since a
  drawn envelope carries no information without sight.
- Colour is never the only signal. Status pills pair colour with a label; the
  matching screen shows reasons as text rather than as a coloured score alone.
