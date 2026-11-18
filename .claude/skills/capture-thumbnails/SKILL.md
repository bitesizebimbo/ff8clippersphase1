---
name: capture-thumbnails
description: Capture missing Instagram and TikTok thumbnails for the Clippers dashboard and push them to GitHub. Use when the user asks to fetch, capture, collect or update post images, pictures, thumbnails or covers, or after new posts were added to the campaign sheets. Instagram blocks cloud machines, so the Instagram step must run on the user's own computer (a home or office connection); TikTok works anywhere.
---

# Capture thumbnails

The dashboard shows a cover picture for each post. Instagram and TikTok
don't offer them through an API, so `dashboard/scripts/` captures them
ahead of time:

- `npm run capture:meta-thumbnails`: Instagram. It opens each post in
  Google Chrome and screenshots the video.
- `npm run capture:tiktok-thumbnails`: TikTok. It saves the cover image
  from TikTok's embed player.

Both read every post link from the live campaign sheets and skip posts that
already have a picture, so a rerun only fetches new posts. Their output is
`dashboard/public/thumbnails/*.jpg` plus the manifest
`dashboard/data/thumbnails.json`. The dashboard and the HTML export read
both.

## Steps

Work from the repository root. Explain each step to the user in plain
language, without jargon. The user is not a developer.

1. **Get the latest version.** Run `git checkout main && git pull origin main`.
   If there are local changes, show them to the user and ask before you
   stash or discard anything.

2. **Check the setup** in `dashboard/`:
   - If `node_modules/` is missing, run `npm install`.
   - Check that `dashboard/.env.local` exists and defines
     `GOOGLE_SHEETS_CLIENT_EMAIL` and `GOOGLE_SHEETS_PRIVATE_KEY`. Check
     only that the names are there. Never print, copy or commit the
     values. If the file is missing, ask the user for it; don't invent
     keys. Without it the scripts can't read the sheets.
   - The Instagram script needs Google Chrome. Check with
     `ls "/Applications/Google Chrome.app"` on macOS. If it's missing,
     ask the user to install Chrome.

3. **Instagram**, only on the user's own computer. If this session runs
   in the cloud, skip this step and say why: Instagram blocks cloud
   machines.
   ```
   cd dashboard && npm run capture:meta-thumbnails
   ```
   - It can take a while, about 10 seconds per post on purpose so
     Instagram doesn't block it. Run it in the background and give the
     user a progress update every few minutes from its output.
   - If it stops because Instagram is rate-limiting, tell the user to try
     again in an hour or so. Everything captured so far is kept.
   - To test first, run `npm run capture:meta-thumbnails -- --limit 3`.

4. **TikTok**, anywhere:
   ```
   cd dashboard && npm run capture:tiktok-thumbnails
   ```

5. **Report the results** from the last lines of each run ("Captured N,
   failed M" for Instagram, "Saved N, failed M" for TikTok).
   - Failures are normal. They are mostly posts that were deleted, made
     private, region-locked or age-restricted, and retrying doesn't help.
   - If the Instagram run failed for most posts, look at the screenshots
     in `dashboard/capture-debug/` and tell the user what the page showed
     (for example a login wall).

6. **Save and push the pictures.** If nothing new was captured, say so and
   stop. Otherwise commit only the picture files and the manifest:
   ```
   git add dashboard/data/thumbnails.json dashboard/public/thumbnails
   git commit -m "new IG pictures"
   git push origin main
   ```
   - Never commit `.env.local`, `dashboard/capture-debug/` or
     `dashboard/exports/`. `.gitignore` excludes them, but check
     `git status` before you commit.
   - If the push is rejected because GitHub has newer commits, run
     `git pull --rebase origin main`, then push again.

7. **Tell the user it's done.** Say how many pictures were added for
   Instagram and TikTok, and that whoever exports the dashboard (or the
   Vercel site, after it redeploys) will now show them.

## Watching or fixing a single post

- `npm run capture:meta-thumbnails -- --headed --url <instagram post url>`
  shows the browser window for that one post.
- `--force` re-captures posts that already have a picture. Use it only
  when the user asks for a picture to be replaced.
