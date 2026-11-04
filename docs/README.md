# /dev/null Games Playground

A standalone collection of seven small, playable daily game prototypes for evaluating gameplay before proposing anything for upstream /dev/null.

## Play

Open the published GitHub Pages homepage and choose a game:

- **Commit Grid:** place cards to build matching lines and blocks.
- **Merge Mayhem:** merge adjacent identical symbols.
- **Cache Crash:** flip hidden cards and bank points before crashing.
- **Bug Bingo:** mark one matching square per draw to complete lines.
- **Flip or Ship:** memory matching with a push-your-luck decision.
- **Bug Bash:** move a rubber duck through bugs in twenty-five moves.
- **Bug Drop:** drop matching tiles and create cascades.

The site is pure HTML, CSS and JavaScript modules. It needs no build step, package install, database, authentication or API.

## Run locally

From the repository root, serve the \`docs\` directory with a static web server, then open the local address. For example:

\`\`\`sh
python3 -m http.server 8080 --directory docs
\`\`\`

Run smoke tests from the repository root with Node.js 22 or newer:

\`\`\`sh
node --test docs/tests/*.test.mjs
\`\`\`

## Deploy

This branch includes a GitHub Actions workflow at \`.github/workflows/games-playground.yml\`. In the fork's **Settings → Pages**, choose **GitHub Actions** as the deployment source. The workflow tests the games and publishes the contents of \`docs/\` when the \`games-playground\` branch changes.

The expected project Pages URL is \`https://mrpunyapal.github.io/dev-null.sh/\`, once Pages is enabled and deployment succeeds. Do not treat it as live before verifying it.

## Limits

- Daily content is deterministic based on the UTC date and game ID.
- Unlimited practice and one local best per game/day, stored with localStorage if permitted.
- Results are **not** verified and cannot be used for global competition.
- No ranked-attempt enforcement, public leaderboards, accounts, XP or streak tracking.
- No images, third-party libraries, external services or telemetry.

The goal is to evaluate which games are actually fun. The entire playground is isolated on the fork's \`games-playground\` branch, leaving the production Laravel app unchanged.
