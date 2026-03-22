# Stories and Reviews

## Current State
Story objects have a `published: boolean` field. New stories default to `published: false`. The admin panel shows all stories. The main site filters to only `published: true` stories. There is a small checkbox labeled "Published" in the story edit form, but it is easy to miss, causing confusion.

## Requested Changes (Diff)

### Add
- Dedicated "Publish" button (green) and "Save as Draft" button in the story edit form
- Clear Draft/Published status badge on each story card in the admin panel
- One-click "Publish" / "Unpublish" toggle button directly on each story card in the admin panel (without opening the edit form)
- Draft mode is now an explicit, named feature

### Modify
- Remove the plain checkbox for "Published" in the edit form; replace with two clear action buttons: "Publish" and "Save as Draft"
- Make the Draft/Published badge more prominent on admin story cards
- Admin panel story list should show a quick toggle button per story

### Remove
- The small, easy-to-miss "Published" checkbox in the edit form

## Implementation Plan
1. In the story edit form, replace the Published checkbox with two buttons at the bottom: "Save as Draft" (saves with published:false) and "Publish" (saves with published:true)
2. On each story card in the admin panel list, add a prominent status badge (Draft in gray, Published in teal) and a quick toggle button ("Publish" if draft, "Unpublish" if published)
3. Add a `togglePublished(id)` helper function that flips the published state of a story without opening the edit form
