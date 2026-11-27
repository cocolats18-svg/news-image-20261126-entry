# The World in One Day — 26 November 2026

[![make.fun](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/c/news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/cocolats18-svg/news-image-20261126-entry/rank.svg)](https://make.fun/c/news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/cocolats18-svg/news-image-20261126-entry/reward.svg)](https://make.fun/c/news-image-20261126)

A newspaper-style front page summing up the world news of Thursday 26 November 2026 in a single drawn image: the drone attack on Kuwait that killed two Italian technicians, Iran tightening Strait of Hormuz transit after uncorroborated mine-strike claims, the US proposing tariffs on 14 trading partners, Pablo Hernández de Cos picked to lead the ECB, the Cairo Ring Road tanker fire, the Macy's Thanksgiving Day Parade postponed by storm, UK net migration falling to 77,000 — plus an "ALSO" strip of the day's other headlines.

`main.ts` (Node 22, standard library only) draws the whole page itself — its own PNG encoder, a hand-built 5×7 bitmap font, and original vector illustrations — and writes `entry.png` deterministically: two runs produce byte-identical output.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Referral: https://make.fun/r/8z4pvdk9
