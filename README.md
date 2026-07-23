# mig-app.github.io

The public site for **MiG: Russian Tutor**, a free Russian vocabulary app for
iOS.

Live at: https://mig-app.github.io

## What this site is

Information and a signpost. It explains what mig is and sends people to where
it runs. It is not a place to practice.

Practice used to happen here too: `/flash/`, `/repeat/` and `/cards/` were
browser versions of three modes, running on a generated copy of the whole
vocabulary. They were removed in favour of one place per job, because a browser
version that cannot keep your place, your streak, or the words you already know
is a worse copy of the app, and a second copy of the corpus is a second thing
to keep true. `404.html` catches those old links and says where practice went.

## Pages

- `index.html` : the landing page
- `404.html` : also the landing spot for the retired `/flash/`, `/repeat/`, `/cards/`
- `privacy.html` : privacy policy (an App Store requirement)
- `support.html` : support contact and FAQs (an App Store requirement)
- `style.css` : shared stylesheet
- `tokens.css` : design tokens, vendored from the design system
- `theme.js` : the light and dark toggle
- `BRAND.md` : how the app, this site and the youtube channel divide the work

## About the app

Four ways through any set: блиц to read it at speed, карточки to flip through
it, повторяй to say each word aloud and be scored on your device, слушай to
listen hands free on a walk. 1363 words across 27 themed sets, a1 to b1, plus
everyday sentences. No accounts, no ads, nothing collected, works offline.

Deploying: merging to `main` publishes. Always work on a branch and open a PR.

Created by [Devin Dyson](https://github.com/ddyson1).
