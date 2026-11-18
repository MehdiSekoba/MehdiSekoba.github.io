# Mehdi Sekoba — GitHub Pages Portfolio

Static portfolio for GitHub Pages, centered on Android development and open-source libraries.

## Publish
1. Create a repository named `MehdiSekoba.github.io`.
2. Copy `index.html` and `style.css` to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch → main → / (root)**.
5. Save and wait for GitHub Pages to deploy.

The project intentionally avoids hard-coded GitHub star/repository counts so the portfolio does not become stale.


## Automatic library updates

The portfolio can discover new public repositories and update the Open Source section automatically.

1. Keep the repository named `MehdiSekoba.github.io` as the GitHub Pages site.
2. In each new public library repository, add the GitHub repository topic `portfolio` (Settings → General → Topics). This is the opt-in flag; untagged experiments and forks are not added.
3. The workflow in `.github/workflows/sync-portfolio.yml` checks every 6 hours, reads the repository description, language, topics and first suitable README image, then updates `projects.json`.
4. To refresh immediately: open the site repository → Actions → Sync portfolio projects → Run workflow.

The five current featured libraries are included by name in `portfolio.config.json`. New repositories are included when tagged with `portfolio`. The workflow uses the built-in `GITHUB_TOKEN`; no personal access token or secret needs to be created.
