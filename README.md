# chxnathanaels.github.io

Personal site of Christian Nathanael Santoso — a little desktop OS in the browser, with a normal "website mode".

- `index.html` — the whole site (content lives in the `P` object near the top of the script)
- `img/` — photos
- Blog posts come from Hashnode (`HASHNODE_HOST` in `index.html`). Write at hashnode.com and they show up in the Journal.

## Posting an activity (event, talk, workshop…)

Write a normal post on Hashnode and add the tag **`activity`**, or start the title with `[Activity]`.
Optionally, put detail lines at the very top of the post, each on its own line:

```
Date: 28 Oct 2026
Location: JIExpo Kemayoran, Jakarta
Role: Speaker
Type: Presentation
Organizer: Indo Automation Expo
```

`Type` can be anything (Presentation, Workshop, Exhibition, Hackathon, Webinar…); it becomes the badge and filter.
If `Date` is missing, the publish date is used. The cover image or the first photo in the post becomes the thumbnail.
Activity posts appear in the **Activities** app and are left out of the Journal. They sync every hour
(or run *Actions → Sync Hashnode posts → Run workflow*).
