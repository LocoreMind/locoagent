---
description: "X.com (Twitter) platform operations playbook for agent-browser. Covers browse, engagement, content creation, social graph, profile, navigation, and lists operations with tested step-by-step agent-browser commands."
allowed-tools:
  - Bash
user-invocable: true
---

# X.com (Twitter) — Agent Browser Playbook

Platform-specific operation sequences for agent-browser on x.com.
Each operation documents: preconditions, step-by-step agent-browser commands, verification method, and known pitfalls.

**Status**: All sections (1-7) tested and documented.
**Tested with**: agent-browser 0.24.0, Chrome CDP on port 9222, account @mashijiann.
**Last updated**: 2026-05-06

---

## Table of Contents

- [1. Browse & Read](#1-browse--read)
  - [1.1 Open Home Timeline](#11-open-home-timeline)
  - [1.2 Open a Specific Tweet by URL](#12-open-a-specific-tweet-by-url)
  - [1.3 Search Tweets by Keyword](#13-search-tweets-by-keyword)
  - [1.4 View a User Profile](#14-view-a-user-profile)
  - [1.5 Read Tweet Thread / Replies](#15-read-tweet-thread--replies)
  - [1.6 Read Notifications](#16-read-notifications)
  - [1.7 Read DMs (Direct Messages)](#17-read-dms-direct-messages)
- [2. Engagement — React to Content](#2-engagement--react-to-content)
  - [2.1 Like a Tweet](#21-like-a-tweet)
  - [2.2 Unlike a Tweet](#22-unlike-a-tweet)
  - [2.3 Retweet (Repost)](#23-retweet-repost)
  - [2.4 Undo Retweet](#24-undo-retweet)
  - [2.5 Bookmark a Tweet](#25-bookmark-a-tweet)
  - [2.6 Remove Bookmark](#26-remove-bookmark)
- [3. Content Creation](#3-content-creation)
  - [3.1 Post a New Tweet (Text Only)](#31-post-a-new-tweet-text-only)
  - [3.2 Post a Tweet with Image](#32-post-a-tweet-with-image)
  - [3.3 Reply to a Tweet](#33-reply-to-a-tweet)
  - [3.4 Quote Tweet](#34-quote-tweet)
  - [3.5 Delete Own Tweet](#35-delete-own-tweet)
- [4. Social Graph](#4-social-graph)
  - [4.1 Follow a User](#41-follow-a-user)
  - [4.2 Unfollow a User](#42-unfollow-a-user)
  - [4.3 View Followers List](#43-view-followers-list)
  - [4.4 View Following List](#44-view-following-list)
- [5. Profile Management](#5-profile-management)
  - [5.1 View Own Profile](#51-view-own-profile)
  - [5.2 Edit Bio / Display Name](#52-edit-bio--display-name)
  - [5.3 Pin a Tweet](#53-pin-a-tweet)
- [6. Navigation & Utility](#6-navigation--utility)
  - [6.1 Switch Between Tabs (For You / Following)](#61-switch-between-tabs-for-you--following)
  - [6.2 Scroll to Load More Tweets](#62-scroll-to-load-more-tweets)
  - [6.3 Handle Login Popups / Modals](#63-handle-login-popups--modals)
  - [6.4 Handle Cookie Consent Banner](#64-handle-cookie-consent-banner)
  - [6.5 Dismiss "Turn on notifications" Prompt](#65-dismiss-turn-on-notifications-prompt)
- [7. Lists](#7-lists)
  - [7.1 View Own Lists](#71-view-own-lists)
  - [7.2 View a List Timeline](#72-view-a-list-timeline)
  - [7.3 Browse List Members](#73-browse-list-members)
  - [7.4 Create a New List](#74-create-a-new-list)
  - [7.5 Add Member to List](#75-add-member-to-list)
  - [7.6 Remove Member from List](#76-remove-member-from-list)
  - [7.7 Delete a List](#77-delete-a-list)

---

> **Device targeting:** Operations run against desktop Chrome by default. To
> operate the mobile web surface, set `DEVICE_PROFILE=ios|android` in `.env` or
> prefix agent-browser commands with `-p ios|android`. When logging an action,
> pass `--device <target>` for provenance (it does not change dedup — a like is
> account-level).

## 1. Browse & Read

### 1.1 Open Home Timeline

**Goal**: Navigate to the home timeline and confirm it loaded.

**Preconditions**: Logged in (Chrome CDP session with cookies).

**Steps**:
```bash
agent-browser open https://x.com/home
```

**Verification**:
```bash
# Title should contain "Home / X"
agent-browser get title
# URL should be https://x.com/home
agent-browser get url
# Snapshot should show region "Your Home Timeline" and tab "For you"
agent-browser snapshot -i -c -s '[role="region"]'
```

**Key Elements**:
- Navigation sidebar: `navigation "Primary"` — contains links: Home, Search and explore, Notifications, Direct Messages, Grok, Premium, Bookmarks, Profile
- Timeline tabs: `tab "For you"` (default selected), `tab "Following"`, possibly custom tabs
- Compose area: `textbox "Post text"` — inline compose on home page
- Account button: `button "Account menu"` — shows logged-in username
- Timeline region: `region "Your Home Timeline"` — contains tweet `article` elements

**Known Issues**:
- None

---

### 1.2 Open a Specific Tweet by URL

**Goal**: Navigate directly to a tweet and read its content.

**Preconditions**: Have the tweet URL (e.g. `https://x.com/user/status/123456`).

**Steps**:
```bash
agent-browser open "https://x.com/<username>/status/<tweet_id>"
```

**Verification**:
```bash
# Title should contain the author's name and tweet content preview
agent-browser get title
# URL should match the tweet URL
agent-browser get url
# Snapshot should show the tweet article with full text and engagement buttons
agent-browser snapshot -i -c -s 'article'
```

**Key Elements** (tweet detail page):
- Tweet article: `article` — contains full tweet text, author info, engagement stats
- Author links: `link "<DisplayName> Verified account"`, `link "@<username>"`
- Timestamp: `link "<time> · <date>"` (e.g. `"2:30 PM · May 5, 2026"`)
- View count: `link "<N> Views"`
- Engagement buttons: `button "N Reply. Reply"`, `button "N reposts. Repost"`, `button "N Likes. Like"`, `button "N Bookmarks. Bookmark"`, `button "Share post"`
- Subscribe button: `button "Subscribe to @<username>"`

**Known Issues**:
- None

---

### 1.3 Search Tweets by Keyword

**Goal**: Search for tweets matching a keyword or query, read the results.

**Preconditions**: Logged in.

**Steps**:
```bash
# For "Top" results (default):
agent-browser open "https://x.com/search?q=<url_encoded_query>&src=typed_query"

# For "Latest" results:
agent-browser open "https://x.com/search?q=<url_encoded_query>&src=typed_query&f=live"

# For "People" results:
agent-browser open "https://x.com/search?q=<url_encoded_query>&src=typed_query&f=user"

# For "Media" results:
agent-browser open "https://x.com/search?q=<url_encoded_query>&src=typed_query&f=image"
```

**Verification**:
```bash
# Title should contain "<query> - Search / X"
agent-browser get title
# Check which tab is active
agent-browser snapshot -i -c -s '[role="tablist"]'
# Read search result tweets
agent-browser snapshot -i -c -s 'article'
```

**Key Elements**:
- Search tabs: `tab "Top"`, `tab "Latest"`, `tab "People"`, `tab "Media"`, `tab "Lists"`
- The `f` URL parameter controls tab: omitted = Top, `live` = Latest, `user` = People, `image` = Media
- Back button: `button "Back"` — returns to previous page
- Each result is an `article` element identical in structure to timeline tweets

**Known Issues**:
- URL-encode the query string (spaces → `%20`, etc.)
- Search results may show "login wall" for non-authenticated sessions
- X advanced search operators work: `from:user`, `since:2026-01-01`, `min_faves:100`, etc.

---

### 1.4 View a User Profile

**Goal**: Navigate to a user's profile and read their bio and multiple recent tweets.

**Preconditions**: Have the username or profile URL.

**Steps**:
```bash
# 1. Navigate to profile
agent-browser open "https://x.com/<username>"

# 2. Initial snapshot — typically only shows the PINNED tweet (if any)
agent-browser snapshot -i -c -s 'article'
# WARNING: The first article is usually the pinned tweet, NOT the latest post.
# You MUST scroll down to see actual recent posts.

# 3. Scroll down to load recent posts (past the pinned tweet and profile header)
agent-browser scroll down 3000
agent-browser wait 2000
agent-browser snapshot -i -c -s 'article'
# Now you should see the first recent (non-pinned) post

# 4. Continue scrolling to load more posts — repeat as needed
agent-browser scroll down 3000
agent-browser wait 2000
agent-browser snapshot -i -c -s 'article'
```

**Verification**:
```bash
# Title should contain "<DisplayName> (@<username>) / X"
agent-browser get title
# URL should be https://x.com/<username>
agent-browser get url
```

**Key Pattern — Browsing Multiple Posts**:
```bash
# To browse N posts from a user's profile, use this scroll loop:
# Each scroll+wait cycle reveals ~1 new post due to virtualized list
for i in $(seq 1 N); do
  agent-browser scroll down 3000
  sleep 2  # or: agent-browser wait 2000
  agent-browser snapshot -i -c -s 'article'
  # Process the visible article(s)
done
```

**Known Issues**:
- **CRITICAL**: The initial page view typically only shows the pinned tweet. **You MUST scroll down to see recent posts.** Agents often mistakenly think the pinned tweet is the only content.
- X uses a virtualized list — only 1-2 articles in the viewport are in the DOM at any time. Scrolled-past articles are removed from DOM.
- Scroll amount of 3000px + 2 second wait reliably loads next batch
- Pinned tweet has text `"Pinned"` at the beginning of its article description — use this to identify and skip it
- Profile has tabs: Posts, Replies, Highlights, Media, Likes — default is "Posts" which excludes replies. Use `https://x.com/<username>/with_replies` for posts + replies.

---

### 1.5 Read Tweet Thread / Replies

**Goal**: Open a tweet and read the full thread and replies below it.

**Preconditions**: Have the tweet URL.

**Steps**:
```bash
# 1. Open the tweet
agent-browser open "https://x.com/<username>/status/<tweet_id>"

# 2. Scroll down to load replies
agent-browser scroll down 800

# 3. Read replies (they appear as additional article elements below the main tweet)
agent-browser snapshot -i -c -s 'article'
```

**Verification**:
```bash
# Multiple article elements should be present — first is the main tweet, rest are replies
agent-browser snapshot -i -c -s 'article'
```

**Known Issues**:
- Replies may be paginated — look for `button "Show more replies"` and click it
- "Show probably spam" section may appear — skip it
- Thread context (parent tweets) appears above the main tweet
- **Quote tweet click trap**: If a reply or timeline entry is a quote tweet, clicking the article body navigates to the quoted original post instead of the quote tweet detail page. To navigate to the correct tweet, click the **timestamp link** instead. See section 3.4 Known Issues for full details.

---

### 1.6 Read Notifications

**Goal**: Open the notifications tab and read recent notifications.

**Preconditions**: Logged in.

**Steps**:
```bash
agent-browser open https://x.com/notifications
```

**Verification**:
```bash
# Title should contain "Notifications / X"
agent-browser get title
# URL should be https://x.com/notifications
agent-browser get url
```

**Key Elements**:
- Notification tabs: All, Verified, Mentions
- Sidebar link shows unread count: `link "Notifications (N unread notifications)"`

**Known Issues**:
- Notifications have sub-tabs: All, Verified, Mentions

---

### 1.7 Read DMs (Direct Messages)

**Goal**: Open DMs and read recent messages.

**Preconditions**: Logged in.

**Steps**:
```bash
# Note: /messages redirects to /i/chat
agent-browser open https://x.com/messages
```

**Verification**:
```bash
# URL will be https://x.com/i/chat (auto-redirect)
agent-browser get url
```

**Known Issues**:
- URL redirects from `/messages` to `/i/chat`
- DM UI is a side panel or full page depending on viewport
- May require X Premium for some DM features

---

## 2. Engagement — React to Content

### 2.1 Like a Tweet

**Goal**: Like a specific tweet.

**Preconditions**: On a page where the tweet is visible (timeline, tweet detail, search results).

**Steps**:
```bash
# 1. Snapshot to find the Like button for the target tweet
agent-browser snapshot -i -c -s 'article'
# Look for: button "N Likes. Like" (not yet liked) inside the target article

# 2. Click the Like button
agent-browser click <like_button_ref>
```

**Verification**:
```bash
# Snapshot again — button text should change from "Like" to "Liked"
agent-browser snapshot -i -c -s 'article'
# Look for: button "N Likes. Liked"
```

**Element Identification**:
- **Not liked**: `button "N Likes. Like"` — text ends with `. Like`
- **Already liked**: `button "N Likes. Liked"` — text ends with `. Liked`
- The like count N increments by 1 after liking

**Known Issues**:
- Rate limiting: X may restrict rapid likes
- The button ref may change after state change (re-snapshot to get new ref)

---

### 2.2 Unlike a Tweet

**Goal**: Remove a like from a previously liked tweet.

**Preconditions**: Tweet is already liked.

**Steps**:
```bash
# 1. Snapshot to find the Liked button
agent-browser snapshot -i -c -s 'article'
# Look for: button "N Likes. Liked"

# 2. Click the same button to unlike
agent-browser click <liked_button_ref>
```

**Verification**:
```bash
# Button text should revert from "Liked" to "Like"
agent-browser snapshot -i -c -s 'article'
# Look for: button "N Likes. Like"
```

**Element Identification**:
- Same button toggles between Like/Liked states
- Ref may change between states — always re-snapshot

**Known Issues**:
- None

---

### 2.3 Retweet (Repost)

**Goal**: Repost a tweet to own timeline.

**Preconditions**: On a page where the tweet is visible.

**Steps**:
```bash
# 1. Snapshot to find the Repost button
agent-browser snapshot -i -c -s 'article'
# Look for: button "N reposts. Repost" [expanded=false]

# 2. Click Repost button — this opens a DROPDOWN MENU, not the action itself
agent-browser click <repost_button_ref>

# 3. Snapshot to see the dropdown menu items
agent-browser snapshot -i -c -s '[role="menuitem"]'
# Shows: menuitem "Repost" and menuitem "Quote"

# 4. Click "Repost" menu item to execute the repost
agent-browser click <repost_menuitem_ref>
```

**Verification**:
```bash
# Snapshot — button text should change from "Repost" to "Reposted"
agent-browser snapshot -i -c -s 'article'
```

**Element Identification**:
- Repost button: `button "N reposts. Repost" [expanded=false]`
- Dropdown items: `menuitem "Repost"` and `menuitem "Quote"`
- After repost: button becomes `button "N reposts. Reposted"`

**Known Issues**:
- **Two-step operation**: clicking the button opens a dropdown, you must then click the menuitem
- To cancel/close the dropdown without acting: `agent-browser press Escape`

---

### 2.4 Undo Retweet

**Goal**: Remove a repost.

**Preconditions**: Tweet is already retweeted.

**Steps**:
```bash
# 1. Snapshot to find the Reposted button
agent-browser snapshot -i -c -s 'article'
# Look for: button "N reposts. Reposted"

# 2. Click — opens dropdown with "Undo repost" option
agent-browser click <reposted_button_ref>

# 3. Find and click "Undo repost" menu item
agent-browser snapshot -i -c -s '[role="menuitem"]'
agent-browser click <undo_repost_menuitem_ref>
```

**Verification**:
```bash
# Button text should revert to "Repost"
agent-browser snapshot -i -c -s 'article'
```

**Element Identification**:
- Already reposted: `button "N reposts. Reposted"`
- Dropdown item: `menuitem "Undo repost"`

**Known Issues**:
- Same two-step dropdown pattern as Repost

---

### 2.5 Bookmark a Tweet

**Goal**: Bookmark a tweet for later reading.

**Preconditions**: On a page where the tweet is visible.

**Steps**:
```bash
# 1. Snapshot to find the Bookmark button
agent-browser snapshot -i -c -s 'article'
# Look for: button "Bookmark" (on timeline) or button "N Bookmarks. Bookmark" (on tweet detail)

# 2. Click Bookmark button — single click, no dropdown
agent-browser click <bookmark_button_ref>
```

**Verification**:
```bash
# Button text should change from "Bookmark" to "Bookmarked"
agent-browser snapshot -i -c -s 'article'
# Look for: button "Bookmarked" or button "N Bookmarks. Bookmarked"
```

**Element Identification**:
- **Timeline view**: `button "Bookmark"` → `button "Bookmarked"`
- **Tweet detail view**: `button "N Bookmarks. Bookmark"` → `button "N Bookmarks. Bookmarked"`
- Single click — no dropdown or confirmation needed

**Known Issues**:
- Bookmark button ref changes after state change (e.g. e137 → e139) — re-snapshot after clicking

---

### 2.6 Remove Bookmark

**Goal**: Remove a previously bookmarked tweet.

**Preconditions**: Tweet is already bookmarked.

**Steps**:
```bash
# 1. Snapshot to find the Bookmarked button
agent-browser snapshot -i -c -s 'article'
# Look for: button "Bookmarked"

# 2. Click to remove bookmark
agent-browser click <bookmarked_button_ref>
```

**Verification**:
```bash
# Button text should revert from "Bookmarked" to "Bookmark"
agent-browser snapshot -i -c -s 'article'
```

**Element Identification**:
- Same toggle pattern as Like: click "Bookmarked" button to un-bookmark

**Known Issues**:
- None

---

## 3. Content Creation

### 3.1 Post a New Tweet (Text Only)

**Goal**: Compose and publish a new tweet with text only.

**Preconditions**: Logged in, on home timeline (compose area visible).

**Steps**:
```bash
# 1. Navigate to home (compose area is inline on home page)
agent-browser open https://x.com/home

# 2. Snapshot to find the compose textbox
agent-browser snapshot -i -c
# Look for: textbox "Post text"

# 3. Fill the compose area with tweet text
agent-browser fill <textbox_ref> "Your tweet text here"

# 4. Snapshot to confirm text is filled and Post button is enabled
agent-browser snapshot -i -c
# Look for: button "Post" (without [disabled])

# 5. Click Post to send
agent-browser click <post_button_ref>
```

**Verification**:
```bash
# After posting, the compose area should be empty and the tweet should appear in timeline
agent-browser snapshot -i -c -s 'article'
# Look for your tweet as the first article with your username and "Now" timestamp
```

**Element Identification**:
- Compose textbox: `textbox "Post text"` — this is a contenteditable div, NOT a standard `<input>`
- Post button (empty): `button "Post" [disabled]` — disabled when no text
- Post button (ready): `button "Post"` — enabled when text is present
- After posting: tweet appears as `article` with `"@<your_username> Now"` in timeline

**Known Issues**:
- **`fill` works**, `type` and `keyboard type` do NOT work on this contenteditable div
- **CRITICAL — beforeunload trap**: Once you `fill` text into compose, X.com registers a `beforeunload` event. If you navigate away (open, reload) WITHOUT posting or clearing, Chrome shows a "Leave site?" dialog that **freezes agent-browser completely**. The Playwright daemon cannot dismiss this dialog when connected via CDP.
  - **Prevention**: Always either post the tweet or clear text before navigating. To clear: use `agent-browser eval "const el = document.querySelector('[data-testid=\"tweetTextarea_0\"]'); if(el) { el.focus(); document.execCommand('selectAll'); document.execCommand('delete'); }"`
  - **Recovery**: If the dialog appears, the only option is to manually click "Leave" in the Chrome UI, then kill and restart the agent-browser daemon (`pkill -9 -f agent-browser && agent-browser connect 9222`)
- 280 character limit
- `get value` returns empty on this textbox — use snapshot to verify content

---

### 3.2 Post a Tweet with Image

**Goal**: Compose and publish a tweet with one or more images attached.

**Preconditions**: Logged in, on home timeline, image file available on local filesystem.

**Steps**:
```bash
# 1. Navigate to home
agent-browser open https://x.com/home

# 2. Snapshot to find upload elements
agent-browser snapshot -i -c
# Look for: button "Add photos or video" and button "Choose Files"

# 3. Upload image file using the hidden file input
agent-browser upload <choose_files_button_ref> /path/to/image.png

# 4. Wait for image to process
agent-browser wait 2000

# 5. Fill tweet text (optional — image-only tweets are allowed)
agent-browser fill <textbox_ref> "Your tweet text here"

# 6. Click Post
agent-browser click <post_button_ref>
```

**Element Identification**:
- Add media button: `button "Add photos or video"`
- Hidden file input: `button "Choose Files"` — use this with `upload` command
- GIF button: `button "Add a GIF"`
- Generate image: `button "Generate image"`

**Known Issues**:
- Same beforeunload trap as 3.1 applies after filling text or uploading image
- Image processing takes time; wait before clicking Post
- Max 4 images per tweet

---

### 3.3 Reply to a Tweet

**Goal**: Post a reply to a specific tweet.

**Preconditions**: On the tweet detail page (navigate to the tweet URL first).

**Steps**:
```bash
# 1. Open the tweet detail page
agent-browser open "https://x.com/<username>/status/<tweet_id>"

# 2. Snapshot to find the reply compose area (it's below the main tweet)
agent-browser snapshot -i -c
# Look for: textbox "Post text" inside a "Post your reply" container
# Also look for: button "Reply" [disabled]

# 3. Fill the reply text
agent-browser fill <reply_textbox_ref> "Your reply text here"

# 4. Snapshot to confirm Reply button is enabled
agent-browser snapshot -i -c
# Look for: button "Reply" (without [disabled])

# 5. Click Reply to send
agent-browser click <reply_button_ref>
```

**Verification**:
```bash
# After replying, your reply should appear as a new article in the thread
agent-browser snapshot -i -c -s 'article'
# Look for article with your username and "Now" timestamp
```

**Element Identification**:
- Reply compose container: `generic "Post your replyReplyEveryone can reply"`
- Reply textbox: `textbox "Post text"` — same element type as main compose
- Reply button (empty): `button "Reply" [disabled]`
- Reply button (ready): `button "Reply"` — enabled when text is present
- Note: The main tweet also has `button "N Reply. Reply"` (engagement stat) — this is NOT the submit button

**Known Issues**:
- **Recommended approach**: Navigate to tweet detail page first, then use the inline reply box. This is more reliable than clicking reply from timeline (which opens a modal).
- Same beforeunload trap as 3.1 — always post or clear before navigating away
- `fill` works on the reply textbox (same contenteditable div behavior)
- **CRITICAL — Quote tweet navigation trap**: When browsing a timeline and you see a quote tweet (a tweet that embeds another tweet), clicking the article body navigates to the **quoted (embedded) original post**, NOT the quote tweet itself. This means if you want to reply to user A's quote tweet of user B, clicking the article takes you to user B's original post instead. See section 3.4 Known Issues for the correct approach.

---

### 3.4 Quote Tweet

**Goal**: Quote-retweet a tweet with added commentary.

**Preconditions**: On a page where the tweet is visible (timeline, search results, tweet detail).

**Steps**:
```bash
# 1. Snapshot to find the Repost button on the target tweet
agent-browser snapshot -i -c -s 'article'
# Look for: button "N reposts. Repost" [expanded=false]

# 2. Click Repost button to open dropdown
agent-browser click <repost_button_ref>

# 3. Snapshot to find the Quote menu item
agent-browser snapshot -i -c -s '[role="menu"]'
# Shows: menuitem "Repost" and menuitem "Quote"

# 4. Click "Quote" menu item — opens a compose modal
agent-browser click <quote_menuitem_ref>

# 5. Snapshot the compose modal — find textbox and Post button
agent-browser snapshot -i -c
# Look for: textbox "Post text" and button "Post"
# The modal also shows a preview of the quoted tweet

# 6. Fill the quote text
agent-browser fill <textbox_ref> "Your commentary here"

# 7. Click Post to send
agent-browser click <post_button_ref>
```

**Verification**:
```bash
# After posting, the quote tweet should appear in timeline with your text + embedded quoted tweet
agent-browser snapshot -i -c -s 'article'
# Look for article containing your text + "Quote" + original author's content
```

**Element Identification**:
- Repost dropdown: `menuitem "Repost"` and `menuitem "Quote"`
- Quote compose modal: contains `textbox "Post text"` and `button "Post"` — same structure as main compose
- The quoted tweet preview appears as embedded content below the textbox

**Known Issues**:
- Two-step process: Repost button → dropdown → Quote menuitem → compose modal
- Same beforeunload trap as 3.1 in the compose modal
- To cancel: press Escape to close the modal (but clear text first if you've filled any)
- **CRITICAL — Navigating to a quote tweet from timeline**: When a quote tweet appears in a timeline or search results, the article body contains an embedded `link` element pointing to the **quoted original post**. Clicking the article's main clickable area (`generic` element) navigates to the quoted original post's URL — NOT the quote tweet's own URL. This is because the embedded quoted content is wrapped in a `link` that captures click events.
  - **Wrong**: Clicking the article body → navigates to `https://x.com/<quoted_user>/status/<quoted_id>` (the original post)
  - **Correct — Option 1**: Click the quote tweet's **timestamp link** (e.g., `link "Apr 24"`, `link "May 5"`) → navigates to `https://x.com/<quoting_user>/status/<quote_id>` (the quote tweet itself)
  - **Correct — Option 2**: Click the **Reply button** (`button "N Reply. Reply"`) directly from the timeline → opens reply compose targeting the quote tweet's author (no navigation needed)
  - **Correct — Option 3**: If you already know the quote tweet's URL, navigate directly: `agent-browser open "https://x.com/<quoting_user>/status/<quote_id>"`

---

### 3.5 Delete Own Tweet

**Goal**: Delete a tweet posted by the agent's account.

**Preconditions**: Own tweet is visible (on profile, timeline, or search results).

**Steps**:
```bash
# 1. Find the tweet — using search is the most reliable method
agent-browser open "https://x.com/search?q=from%3A<username>%20<keyword>&src=typed_query&f=live"

# 2. Snapshot to find the More button on the target tweet
agent-browser snapshot -i -c -s 'article'
# Look for: button "More" [expanded=false] inside the target article

# 3. IMPORTANT: scroll the More button into view, then click
agent-browser scrollintoview <more_button_ref>
agent-browser click <more_button_ref>

# 4. Snapshot to find the Delete menu item
agent-browser snapshot -i -c
# Look for: menuitem "Delete"

# 5. Click Delete
agent-browser click <delete_menuitem_ref>

# 6. Confirmation dialog appears — click the confirm Delete button
agent-browser snapshot -i -c
# Look for: heading "Delete post?" + button "Delete" + button "Cancel"
agent-browser click <confirm_delete_button_ref>
```

**Verification**:
```bash
# The tweet should disappear from the page / search results
agent-browser snapshot -i -c -s 'article'
# The deleted tweet should no longer be present
```

**Element Identification**:
- More button: `button "More" [expanded=false]` — the "..." menu on each tweet
- Menu items (own tweet): `menuitem "Delete"`, `menuitem "Edit post"`, `menuitem "Pin to your profile"`, `menuitem "Add/remove from Highlights"`, `menuitem "Add/remove from Lists"`, `menuitem "Change who can reply"`, `menuitem "View post activity"`, `menuitem "Embed post"`
- Confirmation dialog: `heading "Delete post?"` + `button "Delete"` + `button "Cancel"`

**Known Issues**:
- **Three-step operation**: More button → Delete menuitem → Confirm dialog
- **`scrollintoview` before clicking More is important** — without it the click may not trigger the dropdown (likely the button is outside the viewport or behind another element)
- Finding own tweets: use search `from:<username> <keyword>` with `f=live` tab for most reliable results. Profile page may have caching delay.
- After deletion, you may be redirected to the previous page or see a "This post was deleted" placeholder

---

## 4. Social Graph

### 4.1 Follow a User

**Goal**: Follow a user from their profile page.

**Preconditions**: On the target user's profile page, not already following.

**Steps**:
```bash
# 1. Navigate to the user's profile
agent-browser open "https://x.com/<username>"

# 2. Snapshot to find the Follow button
agent-browser snapshot -i -c
# Look for: button "Follow @<username>"

# 3. Click Follow
agent-browser click <follow_button_ref>
```

**Verification**:
```bash
# Button should change from "Follow @<username>" to "Unfollow @<username>"
agent-browser snapshot -i -c
# Look for: button "Unfollow @<username>" [expanded=false]
```

**Element Identification**:
- **Not following**: `button "Follow @<username>"`
- **Already following**: `button "Unfollow @<username>" [expanded=false]`
- Note: The button text includes the `@username` — use this to distinguish from "Who to follow" sidebar buttons

**Known Issues**:
- Some accounts are protected; follow sends a request instead of immediately following
- Single click — no confirmation needed

---

### 4.2 Unfollow a User

**Goal**: Unfollow a user.

**Preconditions**: On the target user's profile page, already following.

**Steps**:
```bash
# 1. Snapshot to find the Unfollow button
agent-browser snapshot -i -c
# Look for: button "Unfollow @<username>" [expanded=false]

# 2. Click Unfollow — this opens a DROPDOWN (not direct action)
agent-browser click <unfollow_button_ref>

# 3. Snapshot to find the confirm menuitem
agent-browser snapshot -i -c
# Look for: menuitem "Unfollow @<username>"

# 4. Click the menuitem to confirm
agent-browser click <unfollow_menuitem_ref>
```

**Verification**:
```bash
# Button should revert to "Follow @<username>"
agent-browser snapshot -i -c
# Look for: button "Follow @<username>"
```

**Element Identification**:
- Unfollow button: `button "Unfollow @<username>" [expanded=false]`
- Dropdown confirm: `menuitem "Unfollow @<username>"`
- After unfollow: reverts to `button "Follow @<username>"`

**Known Issues**:
- **Two-step operation**: click Unfollow button → dropdown appears → click menuitem to confirm
- To cancel: press Escape to close dropdown

---

### 4.3 View Followers List

**Goal**: View the followers list of a user.

**Preconditions**: Have the username.

**Steps**:
```bash
agent-browser open "https://x.com/<username>/followers"
```

**Verification**:
```bash
# Title should contain "People following <DisplayName> (@<username>) / X"
agent-browser get title
```

**Known Issues**:
- List is virtualized — only visible items are in DOM. Scroll to load more.

---

### 4.4 View Following List

**Goal**: View the following list of a user.

**Preconditions**: Have the username.

**Steps**:
```bash
agent-browser open "https://x.com/<username>/following"
```

**Verification**:
```bash
# Title should contain "People followed by <DisplayName> (@<username>) / X"
agent-browser get title
```

**Known Issues**:
- Same virtualization as followers list

---

## 5. Profile Management

### 5.1 View Own Profile

**Goal**: Navigate to the agent's own profile page.

**Preconditions**: Logged in, know own username.

**Steps**:
```bash
agent-browser open "https://x.com/<own_username>"
```

**Verification**:
```bash
# Title should contain "<DisplayName> (@<username>) / X"
agent-browser get title
```

**Known Issues**:
- None

---

### 5.2 Edit Bio / Display Name

**Goal**: Update the agent account's bio or display name.

**Preconditions**: On own profile page.

**Steps**:
```bash
# 1. Navigate to own profile
agent-browser open "https://x.com/<own_username>"

# 2. Snapshot to find Edit profile link
agent-browser snapshot -i -c
# Look for: link "Edit profile"

# 3. Click Edit profile — opens a modal
agent-browser click <edit_profile_ref>

# 4. Snapshot the modal to find fields
agent-browser snapshot -i -c
# Look for:
#   textbox "Name": current display name
#   textbox "Bio": current bio
#   textbox "Location": current location
#   textbox "Website": current website
#   button "Save"

# 5. Edit the desired field(s) using fill
agent-browser fill <bio_textbox_ref> "New bio text here"

# 6. Click Save
agent-browser click <save_button_ref>
```

**Verification**:
```bash
# Modal should close. Reload profile and check updated content.
agent-browser open "https://x.com/<own_username>"
agent-browser snapshot -i -c
```

**Element Identification**:
- Edit profile link: `link "Edit profile"` — on own profile page only
- Modal fields: `textbox "Name"`, `textbox "Bio"`, `textbox "Location"`, `textbox "Website"`
- Save button: `button "Save"`
- Close without saving: press Escape (may trigger beforeunload if fields were modified)

**Known Issues**:
- These are standard `textbox` elements (not contenteditable divs) — `fill` works normally
- Bio has a 160 character limit
- Name has a 50 character limit

---

### 5.3 Pin a Tweet

**Goal**: Pin a tweet to the top of own profile.

**Preconditions**: On own tweet (visible on profile, search results, or tweet detail page).

**Steps**:
```bash
# 1. Find own tweet and its More button (same as 3.5 Delete flow)
agent-browser snapshot -i -c -s 'article'
# Look for: button "More" [expanded=false] on the target tweet

# 2. Scroll into view and click More
agent-browser scrollintoview <more_button_ref>
agent-browser click <more_button_ref>

# 3. Find and click "Pin to your profile"
agent-browser snapshot -i -c
# Look for: menuitem "Pin to your profile"
agent-browser click <pin_menuitem_ref>

# 4. Confirm in the dialog (if one appears)
agent-browser snapshot -i -c
# Look for confirmation button and click it
```

**Element Identification**:
- Menu item: `menuitem "Pin to your profile"`
- If already pinned: `menuitem "Unpin from profile"` appears instead

**Known Issues**:
- Same More button pattern as Delete (3.5) — use `scrollintoview` before clicking
- Only one tweet can be pinned at a time; pinning a new one unpins the old one

---

## 6. Navigation & Utility

### 6.1 Switch Between Tabs (For You / Following)

**Goal**: Switch the home timeline between "For you" and "Following" tabs.

**Preconditions**: On home timeline.

**Steps**:
```bash
# 1. Navigate to home
agent-browser open https://x.com/home

# 2. Snapshot the tablist to see available tabs
agent-browser snapshot -i -c -s '[role="tablist"]'
# Shows: tab "For you" [selected], tab "Following", possibly custom tabs

# 3. Click the desired tab
agent-browser click <tab_ref>
```

**Verification**:
```bash
# The clicked tab should now have [selected] attribute
agent-browser snapshot -i -c -s '[role="tablist"]'
```

**Element Identification**:
- Tabs are `tab` role elements inside a `tablist`
- Selected tab has `[selected]` attribute
- Default tabs: `tab "For you"`, `tab "Following"`
- Users may have custom tabs (e.g. Lists)

**Known Issues**:
- Tab names may vary by locale
- Custom tabs may be present (user-created Lists pinned to home)

---

### 6.2 Scroll to Load More Tweets

**Goal**: Scroll down to trigger lazy-loading of additional tweets.

**Preconditions**: On any timeline or search results page.

**Steps**:
```bash
# Scroll down by pixel amount
agent-browser scroll down 2000

# Wait for new content to load
agent-browser wait 2000

# Check loaded content
agent-browser snapshot -i -c -s 'article'
```

**Verification**:
```bash
# New articles should be present in the snapshot
agent-browser snapshot -i -c -s 'article'
```

**Known Issues**:
- X uses a **virtualized list** — only articles in the current viewport are in the DOM. Scrolled-past articles are removed. So `snapshot -s 'article'` always shows ~1-3 articles regardless of how many have been loaded.
- Multiple scroll operations may be needed: `agent-browser scroll down 2000` repeated
- Scroll amount of 2000-3000px is typically enough to trigger lazy load

---

### 6.3 Handle Login Popups / Modals

**Goal**: Dismiss the "Sign in" or "Create account" overlay that X shows to non-authenticated users or as a periodic prompt.

**Preconditions**: Popup is visible. Usually only appears for non-authenticated sessions.

**Steps**:
```bash
# Snapshot to identify the popup type and close/dismiss button
agent-browser snapshot -i -c

# Common patterns:
# 1. Close button (X icon): look for button with close-related label
# 2. "Not now" or "Skip" link/button
# 3. Click outside the modal

# Try pressing Escape first
agent-browser press Escape
```

**Known Issues**:
- Multiple types of login prompts exist (bottom bar, full modal, interstitial)
- When using CDP with a logged-in profile, these should not appear
- **A full login wall ("Sign in", "Email or username", "Continue with…") means the isolated
  CDP profile is LOGGED OUT — NOT something to dismiss or work around.** Do not try to log in,
  do not type credentials, do not open a fresh session. STOP and tell the user to log into X
  in the isolated Chrome window (`bun run setup-chrome` reconnects without wiping; `--reset`
  for a clean re-login). Resume only after they confirm they are logged in.
- A small periodic in-app prompt (not a full wall) on an otherwise logged-in timeline can be
  dismissed with `agent-browser press Escape`.

---

### 6.4 Handle Cookie Consent Banner

**Goal**: Accept or dismiss the cookie consent banner.

**Preconditions**: Banner is visible (usually first visit without saved cookies).

**Steps**:
```bash
# Snapshot to find the consent banner
agent-browser snapshot -i -c

# Look for accept/decline buttons — common patterns:
# button "Accept all cookies"
# button "Refuse non-essential cookies"
agent-browser click <accept_button_ref>
```

**Known Issues**:
- When using CDP with an existing Chrome profile, cookie consent is usually already accepted
- Banner may not appear at all in CDP sessions

---

### 6.5 Dismiss "Turn on notifications" Prompt

**Goal**: Close the browser notification permission prompt or X's in-app notification suggestion.

**Preconditions**: Prompt is visible.

**Steps**:
```bash
# For X's in-app prompt (DOM element):
agent-browser snapshot -i -c
# Look for dismiss/close button near the notification suggestion
agent-browser click <dismiss_button_ref>

# For browser-level notification prompt:
# This is handled automatically by agent-browser (auto-dismiss dialogs)
# If not, use --no-auto-dialog flag to prevent it from appearing
```

**Known Issues**:
- Browser-level notification prompt is auto-dismissed by agent-browser by default
- X's in-app prompt is a regular DOM element — find and click the close button
- When using CDP with existing profile, notification permissions are usually already set

---

## 7. Lists

### 7.1 View Own Lists

**Goal**: Navigate to the user's lists management page.

**Preconditions**: Logged in, know own username.

**Steps**:
```bash
agent-browser open "https://x.com/<username>/lists"
```

**Verification**:
```bash
# Title should contain "Lists created by @<username> / X"
agent-browser get title
```

**Key Elements**:
- Create button: `link "Create a new List"`
- Your lists section: `region "Your Lists"` — contains links to each list
- Each list link: `link "<ListName> N members <OwnerName> @<owner> Pin List"`
- Pin button: `button "Pin List"` — pins list to home timeline sidebar
- Discover section: `heading "Discover new Lists"`

**Known Issues**:
- None

---

### 7.2 View a List Timeline

**Goal**: Open a specific list and read its timeline (posts from list members).

**Preconditions**: Know the list URL or navigate from lists page.

**Steps**:
```bash
# Option A: Direct URL (list ID from the lists page)
agent-browser open "https://x.com/i/lists/<list_id>"

# Option B: From lists page, click the list link
agent-browser snapshot -i -c
# Look for: link "<ListName> N members ..."
agent-browser click <list_link_ref>
```

**Verification**:
```bash
# URL should be https://x.com/i/lists/<list_id>
agent-browser get url
# Articles from list members should appear
agent-browser snapshot -i -c -s 'article'
```

**Key Elements** (list timeline page):
- List header with name and member count
- Edit link: `link "Edit List"` — only for own lists
- Members link: `link "N Members"` — opens members modal
- Share button: `button "Share Menu"`
- More button: `button "More"` — additional list options
- Timeline: same `article` structure as home timeline

**Known Issues**:
- Same virtualized list behavior as home timeline — scroll to load more posts
- List URL format is `/i/lists/<numeric_id>`, not a human-readable slug

---

### 7.3 Browse List Members

**Goal**: View all members of a list.

**Preconditions**: On the list timeline page.

**Steps**:
```bash
# 1. On the list page, find and click the Members link
agent-browser snapshot -i -c
# Look for: link "N Members"
agent-browser click <members_link_ref>

# 2. Members modal opens — shows all members
agent-browser snapshot -i -c
# Each member has: button "<Name> @<username> Remove ..." (for own lists)
```

**Verification**:
```bash
# Modal should show heading "List members" and list of members
agent-browser snapshot -i -c
# Look for: heading "List members" and button elements for each member
```

**Element Identification**:
- Members modal: `heading "List members"`
- Each member (own list): `button "<Name> Verified account @<username> Remove ..."`
- Each member has a `button "Remove"` to remove them from the list
- Close modal: press Escape

**Known Issues**:
- Members list may be long — scroll to see all members

---

### 7.4 Create a New List

**Goal**: Create a new list and optionally add initial members.

**Preconditions**: Logged in.

**Steps**:
```bash
# 1. Navigate to lists page
agent-browser open "https://x.com/<username>/lists"

# 2. Click "Create a new List"
agent-browser snapshot -i -c
# Look for: link "Create a new List"
agent-browser click <create_link_ref>

# 3. Fill in list details
agent-browser snapshot -i -c
# Modal shows: textbox "Name", textbox "Description", checkbox "Make private", button "Next" [disabled]
agent-browser fill <name_textbox_ref> "My List Name"
# Optionally: agent-browser fill <description_textbox_ref> "Description"
# Optionally: agent-browser click <make_private_checkbox_ref>

# 4. Click Next (enabled after name is filled)
agent-browser click <next_button_ref>

# 5. Add members page appears — search and add users
agent-browser snapshot -i -c
# Shows: combobox "Search query", tab "Members (0)", tab "Suggested", button "Done"
agent-browser fill <search_combobox_ref> "<username_to_search>"
# Wait for search results
agent-browser wait 1000
agent-browser snapshot -i -c
# Look for: button "Add" next to the user
agent-browser click <add_button_ref>

# 6. Click Done to finish
agent-browser click <done_button_ref>
```

**Verification**:
```bash
# Should redirect to the new list's timeline page
agent-browser get url
# URL should be https://x.com/i/lists/<new_list_id>
```

**Element Identification**:
- Create modal step 1: `textbox "Name"`, `textbox "Description"`, `checkbox "Make private"`, `button "Next" [disabled]`
- Create modal step 2: `combobox "Search query"`, `button "Done"`, `tab "Members (N)"`, `tab "Suggested"`
- Each search result: `button "<Name> @<username> Add ..."` with nested `button "Add"`
- After adding: button changes from `"Add"` to `"Remove"`

**Known Issues**:
- List name **cannot contain special characters** like `[`, `]`, etc. — validation error: "A list's name can't include a disallowed"
- Name max length: 25 characters
- After clicking Next, there's an optional banner photo upload step (can be skipped by proceeding to add members)

---

### 7.5 Add Member to List

**Goal**: Add a user to an existing list.

**Preconditions**: On the list page (own list).

**Steps**:
```bash
# 1. Click Edit List
agent-browser snapshot -i -c
# Look for: link "Edit List"
agent-browser click <edit_list_ref>

# 2. Click "Manage members" tab in the edit modal
agent-browser snapshot -i -c
# Look for: tab "Manage members"
agent-browser click <manage_members_tab_ref>

# 3. Switch to "Suggested" tab to search for users
agent-browser snapshot -i -c -s '[role="tablist"]'
# Look for: tab "Members (N)" and tab "Suggested"
agent-browser click <suggested_tab_ref>

# 4. Search for the user to add
agent-browser snapshot -i -c
# Look for: combobox "Search query"
agent-browser fill <search_combobox_ref> "<username>"
agent-browser wait 1000

# 5. Click Add on the search result
agent-browser snapshot -i -c
# Look for: button "Add" next to the user
agent-browser click <add_button_ref>
```

**Verification**:
```bash
# The button should change from "Add" to "Remove"
# Members tab count should increment: tab "Members (N+1)"
agent-browser snapshot -i -c
```

**Element Identification**:
- Manage members modal: `heading "Manage members"`
- Sub-tabs: `tab "Members (N)"` [selected], `tab "Suggested"`
- Search: `combobox "Search query"`
- Each user: `button "Add"` (not added) or `button "Remove"` (already in list)

**Known Issues**:
- None

---

### 7.6 Remove Member from List

**Goal**: Remove a user from an existing list.

**Preconditions**: On the list page (own list), user is a member.

**Steps**:
```bash
# Option A: From Members modal (7.3)
# Each member has a "Remove" button
agent-browser click <remove_button_ref>

# Option B: From Edit List → Manage members → Members tab
agent-browser snapshot -i -c
# Each member row has: button "Remove"
agent-browser click <remove_button_ref>
```

**Verification**:
```bash
# Member count should decrement
# The user should disappear from the members list
agent-browser snapshot -i -c
```

**Known Issues**:
- Remove is immediate — no confirmation dialog
- Member count updates instantly in the tab label

---

### 7.7 Delete a List

**Goal**: Delete an entire list.

**Preconditions**: On the list page (own list).

**Steps**:
```bash
# 1. Click Edit List
agent-browser snapshot -i -c
# Look for: link "Edit List"
agent-browser click <edit_list_ref>

# 2. Click Delete List
agent-browser snapshot -i -c
# Look for: button "Delete List"
agent-browser click <delete_list_button_ref>

# 3. Confirmation dialog appears
agent-browser snapshot -i -c
# Look for: heading "Delete List?" + button "Delete" + button "Cancel"
agent-browser click <confirm_delete_ref>
```

**Verification**:
```bash
# Should redirect to lists page
agent-browser get url
# URL should be https://x.com/<username>/lists/
```

**Element Identification**:
- Edit modal: `button "Delete List"` — red/destructive button at bottom
- Confirmation: `heading "Delete List?"` + `button "Delete"` + `button "Cancel"`

**Known Issues**:
- Deletion is permanent — no undo
- Redirects to `/<username>/lists/` after successful deletion

---

## Testing Notes

### General Approach

For each operation above:

1. Preflight (`bun run doctor --check-cdp`; if down, `bun run setup-chrome`). agent-browser is pinned to the isolated CDP Chrome via `agent-browser.json`, so commands auto-attach — no `connect`/`--cdp` needed. Never open a fresh `--session-name`/`--headed` browser to log in.
2. Run `agent-browser snapshot -i` to see current interactive elements
3. Execute each step, taking snapshots between steps to verify state changes
4. Record the working command sequence
5. Note any element identification strategies (aria-label, role, text content)
6. Test at least 3 times to confirm reliability

### Element Identification Strategy

Do NOT hardcode `@ref` numbers (e.g. `@e3`). Refs change between page loads. Instead, document:
- The aria-label or aria-role to look for
- The text content pattern
- The CSS selector as fallback
- The relative position in the accessibility tree

### Session Management

**There is exactly ONE authorized way to reach a logged-in X session: the isolated
CDP Chrome on port 9222** (launched by `bun run setup-chrome`). See the
"Browser Connection Contract" in the system prompt — it is binding for every operation here.

agent-browser is pinned to that CDP port via `agent-browser.json`, so every command
auto-attaches — no `connect`/`--cdp` needed. Preflight, then just open:
```bash
bun run doctor --check-cdp        # if DOWN: bun run setup-chrome  (idempotent, never touches your normal Chrome)
agent-browser open https://x.com/home
agent-browser snapshot -i -c      # confirm you are logged in (timeline visible, not a login wall)
```
A `Timeout connecting to CDP at 127.0.0.1:9222` error means the isolated Chrome is not
running (run `bun run setup-chrome`) — it is NOT a login problem.

**Do NOT** use `--session-name`, `--headed`, or `--profile` to open a fresh browser and
log in — a fresh session has no cookies and pulls you into an automated login, which gets
the account rate-limited ("We've temporarily limited your login"). **Never type credentials
or attempt a login.** If the CDP profile is logged out, STOP and ask the user to log in once
in the isolated Chrome window (`bun run setup-chrome --reset` for a clean slate), then resume.
