# dough samples

The sounds caiman loads by default (Strudel's [dough-samples](https://github.com/felixroos/dough-samples) set).
Drums play with `s("bd sd hh")`; pitched instruments with `note("c e g").s("piano")`.
Most names have several samples — pick one with `s("bd:3")`.

Totals: 71 drum machines · 128 VCSL instruments/perc · piano · 13 mridangam strokes · 9 Dirt one-shots.

## Drums

Bare slot names play a default kit: `s("bd sd hh oh cp")`.
Switch the drum machine with `.bank(...)`: `s("bd sd hh").bank("RolandTR909")`.

**Slots** (standard abbreviations):

- `bd` bass drum / kick · `sd` snare · `rim` rimshot · `cp` clap
- `hh` closed hat · `oh` open hat · `sh` shaker · `tb` tambourine
- `lt` `mt` `ht` low / mid / high tom · `cb` cowbell
- `rd` ride · `cr` crash · `perc` percussion · `misc` `fx` extras

**Banks** — any of these 71 machines goes in `.bank("…")`.

Classics:
`RolandTR808` `RolandTR909` `RolandTR707` `RolandTR606` `LinnDrum` `AkaiMPC60`
`OberheimDMX` `EmuSP12` `KorgMinipops` `YamahaRX5` `CasioRZ1`.

All:
AJKPercusyn, AkaiLinn, AkaiMPC60, AkaiXR10, AlesisHR16, AlesisSR16, BossDR110,
BossDR220, BossDR55, BossDR550, CasioRZ1, CasioSK1, CasioVL1, DoepferMS404,
EmuDrumulator, EmuModular, EmuSP12, KorgDDM110, KorgKPR77, KorgKR55, KorgKRZ,
KorgM1, KorgMinipops, KorgPoly800, KorgT3, Linn9000, LinnDrum, LinnLM1, LinnLM2,
MFB512, MPC1000, MoogConcertMateMG1, OberheimDMX, RhodesPolaris, RhythmAce,
RolandCompurhythm1000, RolandCompurhythm78, RolandCompurhythm8000, RolandD110,
RolandD70, RolandDDR30, RolandJD990, RolandMC202, RolandMC303, RolandMT32,
RolandR8, RolandS50, RolandSH09, RolandSystem100, RolandTR505, RolandTR606,
RolandTR626, RolandTR707, RolandTR727, RolandTR808, RolandTR909, SakataDPM48,
SequentialCircuitsDrumtracks, SequentialCircuitsTom, SergeModular, SimmonsSDS400,
SimmonsSDS5, SoundmastersR88, UnivoxMicroRhythmer12, ViscoSpaceDrum, XdrumLM8953,
YamahaRM50, YamahaRX21, YamahaRX5, YamahaRY30, YamahaTG33

## Pitched instruments (VCSL + piano)

Play with `note(...)`: `note("c e g").s("marimba")`. ~50 instruments, multi-sampled.

- **Keys**: `piano` (Salamander grand), `steinway`, `kawai`, `fmpiano`, `clavisynth`, `piano1`
- **Mallets**: `marimba`, `xylophone`, `vibraphone`, `glockenspiel`, `kalimba`, `balafon`, `tubularbells`, `handbells`, `handchimes`
- **Winds**: `sax`, `saxello`, `recorder`, `ocarina`, `harmonica`, `super64` (chromatic harmonica)
- **Organ & strings**: `pipeorgan`, `organ`, `harp`, `folkharp`, `dantranh`, `psaltery`, `strumstick`, `kalimba`
- **Other**: `didgeridoo`, `wineglass`, `trainwhistle`, `siren`, `agogo`, `belltree`

Many have articulation variants in the name (e.g. `xylophone_hard_ff`, `vibraphone_bowed`, `recorder_alto_sus`, `sax_stacc`).

## Tuned & world percussion

- **VCSL** (play with `s(...)`): `bongo`, `conga`, `darbuka`, `framedrum`, `timpani`,
  `cajon`, `cabasa`, `clave`, `cowbell`, `gong`, `guiro`, `shaker_small`/`_large`,
  `tambourine`, `triangles`, `vibraslap`, `woodblock`, `slitdrum`, `oceandrum`,
  `sleighbells`, `anvil`, `brakedrum`, `ratchet`, `clap`, `clash`
- **mridangam** (South Indian drum strokes, `s("ta ki dhin")`): `ta`, `ki`, `dhin`,
  `dhum`, `thom`, `nam`, `na`, `tha`, `dhi`, `ka`, `chaapu`, `ardha`, `gumki`

## One-shots & fun (Dirt-Samples)

`casio` (toy keyboard tones), `crow` (caw), `insect`, `wind`, `jazz`, `metal`, `east` (eastern hits), `space`, `numbers` (spoken 0–9).
Each has several variations — `s("numbers:3")`.
