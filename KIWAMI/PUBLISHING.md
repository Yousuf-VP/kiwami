# KIWAMI — Publishing

## Deploy with Vercel

1. Open https://vercel.com/new and import the `Yousuf-VP/kiwami` GitHub repository.
2. In **Configure Project**, set **Root Directory** to `KIWAMI`.
3. Set **Framework Preset** to **Other**.
4. This is a static HTML/CSS/JavaScript project. Leave **Build Command** empty. Set **Output Directory** to `.` if Vercel asks for one. Do not add an install command.
5. Deploy. Vercel will publish the KIWAMI homepage from `KIWAMI/index.html`.
6. Open the deployed domain, then launch SHOOT-STREAK from the Games section. Its direct URL is `https://YOUR-DOMAIN/shoot-streak/`.

## Update an existing Vercel project

1. Open the Vercel project connected to this repository.
2. Go to **Settings → Build and Deployment**.
3. Set **Root Directory** to `KIWAMI` and confirm the Other/static settings above.
4. Under **Git**, make sure the Production Branch is `main`.
5. Merge the reviewed pull request into `main`. Vercel should start a production deployment automatically.
6. Check **Deployments** for a Ready production deployment, then test both the homepage and `/shoot-streak/`.

## Before sharing the link

- Test the game on desktop and a real phone.
- Check start, pause, resume, game-over, audio permissions, and page refresh.
- Confirm the KIWAMI homepage still loads and its SHOOT-STREAK card opens the game.
- The game loads Three.js and web fonts from CDNs, so players need an internet connection.

No build step or package installation is required for this static site.
