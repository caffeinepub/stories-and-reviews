# Stories and Reviews

## Current State
Admin panel has Comments tab with Remove and Ban User buttons per comment. Users identified by author name and principal.

## Requested Changes (Diff)

### Add
- Clicking a user name in admin panel opens a popup with: Comment, Feature Comment, Message Privately, Ban, Unban

### Modify
- Comments and Messages sections: user name becomes clickable, triggers the popup
- Remove standalone Ban User button (replaced by popup)

### Remove
- Standalone Ban User button in comments tab

## Implementation Plan
1. Add UserActionPopup component with 5 action buttons
2. Track open popup state by entry id
3. Wire actions: comment reply, feature toggle, private message compose, ban, unban
4. Highlight featured comments with a badge
