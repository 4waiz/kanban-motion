# Tones

A tone sets the writing, pacing, type, transitions, voice and sound together. Presets are starting points; freeform direction such as "fake Series A launch from 2016" or "museum audio guide" refines them. Map freeform direction to the nearest preset for pacing, and keep the user's wording in the plan.

| Tone | Feel | Plates | Transitions | Type | Voice (Kokoro) | Bed (`bed.py`) | Effects |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default` | Punchy, playful, clean | 4 to 5, 3 to 5 s each | Soft slides, staggered fades | Mixed case, medium weight | `af_heart`, speed 1.05 | `pulse`, major, 100 to 112 bpm | Moderate: drops, soft impacts |
| `polished` | Serious, elegant, restrained | 3 to 4, long holds | Slow fades (0.6 to 0.8 s) | Light to medium, generous tracking | `bf_emma` or `am_michael`, 0.95 | `pad`, minor, 80 to 92 bpm | Few, warm, low |
| `yc-parody` | A deadpan startup launch played straight | 4 to 5, one claim each | Hard cuts | Sentence case, heavy; mono for numbers | `am_michael`, 1.0, flat delivery | `pulse`, major, 96 bpm | Sparse, corporate clicks |
| `chaotic` | Fast, loud, all caps | 6 to 8, some under 2 s | Flash, zoom and whip cuts | Huge, heavy, all caps | `am_fenrir` or `af_bella`, 1.15 | `beat`, minor, 124 to 140 bpm | Dense; glitch and punch allowed |
| `deadpan` | Calm and dry; nothing is a joke | 3 to 4, lots of empty space | Slow fades | Small, quiet, lots of air | `bm_george`, 0.9 | `pad` very low, or silence | Almost none |
| `cinematic` | Trailer-scale, epic claims | 4 to 5, big type | Dramatic wipes, dips to black | Very large, wide tracking | `am_onyx` or `bm_george`, 0.9 | `pad` then `pulse`, minor, 70 to 90 bpm | Bell and heavy impacts on reveals |
| `app-store` | Clean feature cards | 4 to 6 | Smooth slides | Clean sans, medium | `af_nova` or `af_heart`, 1.0 | `pulse`, major, 104 bpm | UI clicks and switches |

## Writing by tone

- **default**: Warm and direct. Set up the reveal with a simple observation: *"Dating apps were built for humans. Obvious mistake."*
- **polished**: The product speaks; one feature per plate, no lists. End on the name and the tagline, then silence.
- **yc-parody**: State the problem with total seriousness: *"Every day, taxis carry us. But who carries the taxis?"* Metrics read as facts, and the URL implies legitimacy.
- **chaotic**: Short shouted fragments, stacked claims, and at least one beat that breaks the rhythm.
- **deadpan**: Understatement. Let a pause land the joke, and never explain it.
- **cinematic**: "In a world..." scale applied to the product's real claims, with a final title card.
- **app-store**: Benefit-led feature cards, each showing the UI doing the thing.

Never let a tone excuse broken laws: the hook, readability and showing the real thing apply to every tone.
