# Launch workflow

Turn a project or a website into a short, polished, postable video. The workflow is: inspect, plan, build, deliver.

## Options

The user can give these as flags or in plain words:

| Option | Default |
| --- | --- |
| `--tone <preset or freeform>` | inferred; `default` if nothing clearly fits |
| `--format landscape \| vertical \| square` | landscape 1920x1080 (vertical 1080x1920, square 1080x1080) |
| `--duration <s>` | about 20 s |
| `--voice` / "with a voiceover" | off unless asked |
| `--no-music`, `--no-sfx` | music and effects on |
| `--title <name>` | inferred from the project |

## 1. Inspect

### What is the input?

| Input | Recognise it by | Material comes from |
| --- | --- | --- |
| Project | No input given and the current directory is a project | The code |
| Website | An `http(s)://` URL or a bare domain | The live site |
| Script or idea | Plain text: "a 15 s teaser that says..." | The user's words. Ask for the brand, colours and assets you need. |

If none of these fit, ask the user what the video is about.

### Project

- Read the main page or entry component, the global styles (exact colours as hex, the font families actually loaded), the README, the routes and the key components.
- Find the product **in use**: entry, key action, result. That flow is the strongest material in the video, stronger than any landing-page section.
- Reuse the real thing. Import the project's CSS and fonts into `reel/`, copy its logo and images into `reel/assets/`, and screenshot or render real screens. If a dev server exists, run it and capture states at the video's aspect ratio for `shot` plates.

### Website

- Get the rendered page, not the raw HTML. Many sites are an empty JavaScript shell until they run, so use a headless browser if a fetch comes back empty. Dismiss cookie banners and scroll section by section, because scroll-triggered content stays blank in one full-page capture.
- Collect:
  - **Copy:** headline, tagline, section headings, feature names, calls to action, testimonials, the title, the meta description and the social tags.
  - **Identity:** colours from the CSS and the fonts the page loads.
  - **Visuals:** the logo, screenshots, hero images and demo videos, saved to `work/`.
- Prefer re-animating the site's real markup and assets over panning across flat screenshots.

### Answer before planning

1. What is it, in one sentence?
2. Who is it for, and what does it do for them?
3. What sets it apart?
4. What is the most impressive, or the funniest, true claim?
5. What is the visual hook for the first 2 seconds?
6. Which real UI or flow will be shown?
7. What tone fits, and why?
8. What does a stranger need to know to try it (name, URL, command)?
9. What is the one-line share caption?

## 2. Plan

Write `kanban-motion-output/plan.md`:

```markdown
# Plan: <name>

## What it is            one sentence
## Angle                 the premise that makes this video about this project and no other
## Hook (0-2.5 s)        the opening image, motion or line
## Highlights            2 or 3 specific moments ("the diff turning green", not "feature callouts")
## Flow shown            entry -> key action -> result, or "landing page only"
## Punchline / outro     the last line before the name and URL
## Tone                  preset + freeform direction + one line on what that means for pacing
## Format / duration     landscape 1920x1080, 20 s
## Identity              background, accent and text colours (hex), display font, body font
## Storyboard            | # | plate | dur | on screen | voice line | sound |
## Narration             the script, if there is a voice (one line per beat)
## Audio                 bed style/key/bpm or user track; key effect cues
## Share copy (draft)    one sentence
```

If the user points at one thing (a new version, a single feature, one angle), make that the whole video.

**Shape:** hook (2 to 3 s), reveal (2 to 4 s), 2 or 3 highlights, punchline/outro (2 to 4 s). Treat it as a starting point, not a template.

**Durations:** with a voice, the voice sets the length: last line + 1.5 to 2.5 s of outro hold. Without one, the storyboard durations must sum to the target.

## Creative laws

- **Short.** 15 to 25 s; 18 to 22 s is the sweet spot. Go longer only for a reason.
- **The hook is everything.** The first 2 seconds decide whether anyone keeps watching. Plan it first.
- **Clear to a stranger.** After one viewing, someone new knows what it does, who it's for and how to get it. Lead with that, not with how it's built.
- **Show the thing.** At least one plate shows real UI, copy or visuals from the product. Small illustrative UI text is fine (a filename, an "Exported" toast). Invented claims, numbers or testimonials are not.
- **Specific.** Use the project's own words. Generic SaaS language such as "streamline your workflow" is banned.
- **Readable.** Pace comes from motion and cuts, never from pulling text away early. Hold any line meant to be read for about 0.3 s per word (0.8 s minimum for a label), counted from when the whole line is settled. Fast in, then hold.
- **Alive.** Typing, simulated clicks, swipes and things arriving one by one beat static slides.
- **Funny earns its place.** Humour comes from the project's own absurdity, not from trying.
- **Every frame postable.** Any frozen frame should be worth sharing. Check stills to prove it.

## 3. Build

1. Copy the starter kit, or open the user's kit, and theme `style.css` with the identity from the plan.
2. If there is a voice: write `script.txt`, generate it, align it (see `voiceover.md`), and drive the cuts from `cut('...')`.
3. Write or adapt the plates. Reuse `say`, `code`, `shot` and `outro`, or write new ones following the same contract.
4. Make the music bed (or beat-grid the user's track) and write `cues.json` (see `sound.md`).
5. Check stills from **every plate and every transition** (`stills --plates`). Fix overflow, collisions, low contrast and text held too briefly. A plain crossfade between two busy layouts gives a muddy double exposure: stagger it (old out, new in) or dip through the background.
6. Mix, then render a draft (`--samples 4`) once the user approves. Render the final with `--samples 8` or higher.

## 4. Deliver

- **Poster:** pick the strongest settled frame (text fully in, not mid-transition), extract it to `out/poster.jpg`, and bake it in as frame 0 (see SKILL.md). Replace frame 0 rather than adding a frame, so duration and sync stay the same.
- **`share-copy.txt`:** 1 to 3 sentences, postable as-is, specific, in the video's tone. Never "excited to share".
- **Report:** tell the user where the files are, give one sentence on the angle, and offer to re-roll a plate, change the voice, or try another tone.
