# Integration Connector Technical Specifications

> **SSOT** for all 20 integration connectors in Consultify.
> Each section contains everything needed to implement a working connection.
>
> Created: 2026-04-02 | Status: Ready for implementation

---

## Table of Contents

| # | App | Category | Auth | API Style |
|---|-----|----------|------|-----------|
| 1 | [Gmail](#1-gmail) | Email & Communication | OAuth 2.0 | REST |
| 2 | [Microsoft Outlook](#2-microsoft-outlook) | Email & Communication | OAuth 2.0 | REST (Graph) |
| 3 | [Slack](#3-slack) | Email & Communication | OAuth 2.0 v2 | REST + Events |
| 4 | [Microsoft Teams](#4-microsoft-teams) | Email & Communication | OAuth 2.0 | REST (Graph) |
| 5 | [Google Calendar](#5-google-calendar) | Calendar | OAuth 2.0 | REST |
| 6 | [Outlook Calendar](#6-outlook-calendar) | Calendar | OAuth 2.0 | REST (Graph) |
| 7 | [Apple Calendar (iCal)](#7-apple-calendar-ical) | Calendar | CalDAV Basic Auth | CalDAV/XML |
| 8 | [Calendly](#8-calendly) | Calendar | OAuth 2.0 + PKCE | REST v2 |
| 9 | [Jira](#9-jira) | Task Management | OAuth 2.0 (3LO) | REST v3 |
| 10 | [Asana](#10-asana) | Task Management | OAuth 2.0 | REST |
| 11 | [Trello](#11-trello) | Task Management | OAuth 1.0a / Token | REST |
| 12 | [ClickUp](#12-clickup) | Task Management | OAuth 2.0 | REST v2 |
| 13 | [Monday.com](#13-mondaycom) | Task Management | OAuth 2.0 | GraphQL |
| 14 | [Notion](#14-notion) | Task Management | OAuth 2.0 | REST |
| 15 | [Todoist](#15-todoist) | Task Management | OAuth 2.0 | REST v2 |
| 16 | [Linear](#16-linear) | Task Management | OAuth 2.0 | GraphQL |
| 17 | [Google Drive](#17-google-drive) | Cloud Storage | OAuth 2.0 | REST v3 |
| 18 | [OneDrive](#18-onedrive) | Cloud Storage | OAuth 2.0 | REST (Graph) |
| 19 | [Dropbox](#19-dropbox) | Cloud Storage | OAuth 2.0 + PKCE | REST v2 |
| 20 | [Box](#20-box) | Cloud Storage | OAuth 2.0 | REST |

---

## Category A: Email & Communication

### 1. Gmail

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Authorization Code + refresh token) |
| **Developer console** | https://console.cloud.google.com/ |
| **API docs** | https://developers.google.com/gmail/api |
| **Node.js SDK** | `npm install googleapis` |
| **Base URL** | `https://gmail.googleapis.com/gmail/v1` |
| **Rate limits** | 250 quota units/user/second; daily quota varies by plan |

#### OAuth 2.0 Flow

```
Authorization URL:  https://accounts.google.com/o/oauth2/v2/auth
Token URL:          https://oauth2.googleapis.com/token
Revoke URL:         https://oauth2.googleapis.com/revoke
```

**Required parameters:**
- `client_id` — from Google Cloud Console
- `client_secret` — from Google Cloud Console
- `redirect_uri` — must match console configuration
- `access_type=offline` — to get refresh token
- `prompt=consent` — force consent screen to get refresh token on first auth

#### Scopes (request minimum needed)

| Scope | Access level | Sensitivity |
|-------|-------------|-------------|
| `https://www.googleapis.com/auth/gmail.readonly` | Read all email | Restricted |
| `https://www.googleapis.com/auth/gmail.send` | Send email | Sensitive |
| `https://www.googleapis.com/auth/gmail.labels` | Manage labels | Non-sensitive |
| `https://www.googleapis.com/auth/gmail.modify` | Read + compose + send | Restricted |
| `https://www.googleapis.com/auth/gmail.metadata` | Headers + labels only | Restricted |
| `https://www.googleapis.com/auth/contacts.readonly` | Read contacts | Sensitive |

**Recommended for Consultify:** `gmail.readonly` + `gmail.send` + `gmail.labels` + `contacts.readonly`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List messages | GET | `/users/me/messages` |
| Get message | GET | `/users/me/messages/{id}` |
| Send message | POST | `/users/me/messages/send` |
| List labels | GET | `/users/me/labels` |
| List contacts | GET | `https://people.googleapis.com/v1/people/me/connections` |

#### Implementation Notes

- Use `googleapis` npm package with `google.auth.OAuth2` client
- Store refresh token in DB; access tokens expire in 1 hour
- For restricted scopes: Google requires app verification (security review)
- Push notifications via `users.watch()` + Pub/Sub topic
- Email body is base64url-encoded in `raw` field

---

### 2. Microsoft Outlook

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Microsoft Identity Platform v2.0) |
| **Developer console** | https://entra.microsoft.com/ (App registrations) |
| **API docs** | https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview |
| **Node.js SDK** | `npm install @microsoft/microsoft-graph-client @azure/msal-node` |
| **Base URL** | `https://graph.microsoft.com/v1.0` |
| **Rate limits** | 10,000 requests/10 min per app per mailbox |

#### OAuth 2.0 Flow

```
Authorization URL:  https://login.microsoftonline.com/common/oauth2/v2.0/authorize
Token URL:          https://login.microsoftonline.com/common/oauth2/v2.0/token
```

Use `common` for multi-tenant; replace with tenant ID for single-tenant.

#### Scopes (Delegated)

| Scope | Access |
|-------|--------|
| `Mail.Read` | Read user's mail |
| `Mail.ReadWrite` | Read/write mail |
| `Mail.Send` | Send mail as user |
| `Contacts.Read` | Read contacts |
| `Contacts.ReadWrite` | Read/write contacts |
| `User.Read` | Read user profile |
| `offline_access` | Get refresh token |

**Recommended for Consultify:** `Mail.Read` + `Mail.Send` + `Contacts.Read` + `User.Read` + `offline_access`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List messages | GET | `/me/messages` |
| Get message | GET | `/me/messages/{id}` |
| Send message | POST | `/me/sendMail` |
| List mail folders | GET | `/me/mailFolders` |
| List contacts | GET | `/me/contacts` |

#### Implementation Notes

- Register app in Microsoft Entra admin center
- Access tokens expire in ~1 hour; use refresh token
- Use `@azure/msal-node` `ConfidentialClientApplication` for token management
- Supports `$select`, `$filter`, `$top`, `$skip` OData query params
- Delta queries available for incremental sync: `GET /me/mailFolders/{id}/messages/delta`

---

### 3. Slack

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 v2 |
| **Developer console** | https://api.slack.com/apps |
| **API docs** | https://api.slack.com/methods |
| **Node.js SDK** | `npm install @slack/web-api @slack/oauth` |
| **Base URL** | `https://slack.com/api/` |
| **Rate limits** | Tier-based: 1-100+ req/min depending on method |

#### OAuth 2.0 v2 Flow

```
Authorization URL:  https://slack.com/oauth/v2/authorize
Token URL:          https://slack.com/api/oauth.v2.access
```

**Two token types:**
- **Bot token** (`xoxb-...`) — app acts as itself; specified via `scope=`
- **User token** (`xoxp-...`) — app acts as user; specified via `user_scope=`

#### Scopes

**Bot scopes (recommended):**

| Scope | Access |
|-------|--------|
| `channels:read` | List public channels |
| `channels:history` | Read public channel messages |
| `chat:write` | Post messages |
| `users:read` | Read user info |
| `users:read.email` | Read user emails |
| `im:write` | Open DMs |
| `reactions:read` | Read reactions |

**User scopes (for acting as user):**

| Scope | Access |
|-------|--------|
| `channels:history` | Read messages as user |
| `search:read` | Search messages |
| `users.profile:read` | Read own profile |

**Recommended for Consultify:** Bot scopes: `channels:read`, `chat:write`, `users:read`, `users:read.email`, `im:write`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List channels | POST | `conversations.list` |
| Post message | POST | `chat.postMessage` |
| Get user info | POST | `users.info` |
| List users | POST | `users.list` |

#### Implementation Notes

- Use `@slack/oauth` `InstallProvider` for multi-workspace installs
- Implement `InstallationStore` interface to persist tokens per workspace
- Events API (webhook) for real-time: `message`, `app_mention`, `reaction_added`
- Socket Mode available for development (no public URL needed)
- All API methods are POST with `application/x-www-form-urlencoded` or JSON body

---

### 4. Microsoft Teams

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Microsoft Identity Platform v2.0) |
| **Developer console** | https://entra.microsoft.com/ (same as Outlook) |
| **API docs** | https://learn.microsoft.com/en-us/graph/teams-concept-overview |
| **Node.js SDK** | `npm install @microsoft/microsoft-graph-client @azure/msal-node` |
| **Base URL** | `https://graph.microsoft.com/v1.0` |
| **Rate limits** | Shared with Graph API limits |

#### OAuth 2.0 Flow

Same as Microsoft Outlook — single app registration covers both.

#### Scopes (Delegated)

| Scope | Access |
|-------|--------|
| `Team.ReadBasic.All` | Read team names and descriptions |
| `Channel.ReadBasic.All` | Read channel names |
| `ChannelMessage.Send` | Send messages to channels |
| `Chat.ReadWrite` | Read/write chats |
| `User.Read` | Read user profile |
| `offline_access` | Refresh token |

**Recommended for Consultify:** `Team.ReadBasic.All` + `Channel.ReadBasic.All` + `ChannelMessage.Send` + `Chat.ReadWrite` + `User.Read` + `offline_access`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List joined teams | GET | `/me/joinedTeams` |
| List channels | GET | `/teams/{team-id}/channels` |
| Send channel message | POST | `/teams/{team-id}/channels/{channel-id}/messages` |
| List chats | GET | `/me/chats` |
| Send chat message | POST | `/chats/{chat-id}/messages` |

#### Implementation Notes

- Shares the same Azure AD app registration as Outlook
- Webhooks via Graph subscriptions: `POST /subscriptions` with `changeType`, `resource`, `notificationUrl`
- Webhook notifications must be validated within 10 seconds
- For sending messages: `ChannelMessage.Send` is the least-privileged scope
- Application-only permissions require admin consent
- Adaptive Cards supported for rich message formatting

---

## Category B: Calendar

### 5. Google Calendar

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (same Google Cloud project as Gmail) |
| **Developer console** | https://console.cloud.google.com/ |
| **API docs** | https://developers.google.com/calendar/api |
| **Node.js SDK** | `npm install googleapis` |
| **Base URL** | `https://www.googleapis.com/calendar/v3` |
| **Rate limits** | 1,000,000 queries/day (default) |

#### OAuth 2.0 Flow

Same as Gmail — can share the same Google Cloud project and OAuth client.

#### Scopes

| Scope | Access |
|-------|--------|
| `https://www.googleapis.com/auth/calendar.readonly` | Read calendars and events |
| `https://www.googleapis.com/auth/calendar` | Full read/write access |
| `https://www.googleapis.com/auth/calendar.events` | Read/write events only |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read events only |

**Recommended for Consultify:** `calendar.events` (read/write events) or `calendar.readonly` (read-only)

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List calendars | GET | `/users/me/calendarList` |
| List events | GET | `/calendars/{calendarId}/events` |
| Create event | POST | `/calendars/{calendarId}/events` |
| Update event | PUT | `/calendars/{calendarId}/events/{eventId}` |
| Delete event | DELETE | `/calendars/{calendarId}/events/{eventId}` |
| Watch for changes | POST | `/calendars/{calendarId}/events/watch` |

#### Implementation Notes

- Use `calendarId = 'primary'` for user's main calendar
- Push notifications via `watch()` + Cloud Pub/Sub or webhook URL
- Incremental sync via `syncToken` parameter on `events.list`
- Free/busy lookup: `POST /freeBusy`
- Recurring events: use `recurrence` field with RRULE format
- Shares OAuth client with Gmail — single consent screen for both

---

### 6. Outlook Calendar

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (same Azure AD app as Outlook Mail) |
| **Developer console** | https://entra.microsoft.com/ |
| **API docs** | https://learn.microsoft.com/en-us/graph/api/resources/calendar |
| **Node.js SDK** | `npm install @microsoft/microsoft-graph-client` |
| **Base URL** | `https://graph.microsoft.com/v1.0` |

#### Scopes (Delegated)

| Scope | Access |
|-------|--------|
| `Calendars.Read` | Read calendar events |
| `Calendars.ReadWrite` | Read/write calendar events |
| `Calendars.Read.Shared` | Read shared calendars |

**Recommended for Consultify:** `Calendars.ReadWrite` + `offline_access`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List calendars | GET | `/me/calendars` |
| List events | GET | `/me/calendar/events` |
| Create event | POST | `/me/calendar/events` |
| Update event | PATCH | `/me/calendar/events/{id}` |
| Delete event | DELETE | `/me/calendar/events/{id}` |
| Get free/busy | POST | `/me/calendar/getSchedule` |

#### Implementation Notes

- Shares Azure AD app with Outlook Mail and Teams
- Delta queries for incremental sync: `GET /me/calendarView/delta`
- Webhook subscriptions for real-time: `POST /subscriptions`
- Supports recurring events, attendees, online meetings
- Room/resource booking via `findMeetingTimes` endpoint

---

### 7. Apple Calendar (iCal)

| Property | Value |
|----------|-------|
| **Auth type** | CalDAV with Basic Authentication (app-specific password) |
| **Protocol** | CalDAV (RFC 4791) over HTTPS |
| **Server URL** | `https://caldav.icloud.com/` |
| **Node.js libraries** | `npm install tsdav` or `npm install dav` |
| **Rate limits** | Undocumented; conservative polling recommended |

#### Authentication

Apple does **not** support OAuth for CalDAV. Authentication uses:

1. **Apple ID email** as username
2. **App-specific password** (not the main Apple ID password)

**Generating app-specific password:**
1. User goes to https://appleid.apple.com/
2. Sign In & Security → App-Specific Passwords
3. Generate password for "Consultify"
4. User enters this password in our connect flow

#### CalDAV Protocol

```
Discovery:    PROPFIND https://caldav.icloud.com/
Calendars:    PROPFIND https://caldav.icloud.com/{user-id}/calendars/
Events:       REPORT  (calendar-query or calendar-multiget)
Create event: PUT     https://caldav.icloud.com/{user-id}/calendars/{cal-id}/{event-uid}.ics
Update event: PUT     (same URL, with If-Match ETag)
Delete event: DELETE  (same URL)
```

#### Key Operations

| Operation | CalDAV Method | Notes |
|-----------|--------------|-------|
| Discover calendars | PROPFIND depth:1 | Returns calendar names, colors, ctags |
| List events | REPORT calendar-query | Filter by date range with `<C:time-range>` |
| Get event | GET | Returns iCalendar (.ics) format |
| Create event | PUT | Send iCalendar data with new UID |
| Sync changes | REPORT sync-collection | Uses `sync-token` for incremental sync |

#### Implementation Notes

- Use `tsdav` library — modern TypeScript CalDAV client with iCloud support
- Events are in iCalendar format (RFC 5545) — parse with `ical.js` or `node-ical`
- No push notifications — must poll with `sync-token`
- User must have 2FA enabled on Apple ID to generate app-specific passwords
- Store app-specific password encrypted in DB
- CalDAV is XML-based (WebDAV extension) — different from REST APIs

---

### 8. Calendly

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 with PKCE (recommended) |
| **Developer console** | https://developer.calendly.com/ |
| **API docs** | https://developer.calendly.com/api-docs |
| **Node.js SDK** | No official SDK — use `axios` or `node-fetch` |
| **Base URL** | `https://api.calendly.com` |
| **Rate limits** | 100 requests/15 seconds per access token |

#### OAuth 2.0 Flow

```
Authorization URL:  https://auth.calendly.com/oauth/authorize
Token URL:          https://auth.calendly.com/oauth/token
```

**PKCE required** — use S256 `code_challenge_method` per RFC 7636.

**Token lifetime:** Access token expires; use refresh token for renewal.

#### Scopes

| Scope | Access |
|-------|--------|
| `default` | Full access to user's Calendly data |

Calendly uses granular capability scopes:

| Scope | Access |
|-------|--------|
| `availability:read` | Read availability |
| `event_types:read` | Read event types |
| `event_types:write` | Manage event types |
| `invitees:read` | Read scheduled events |
| `invitees:write` | Cancel/reschedule events |
| `routing_forms:read` | Read routing forms |
| `shares:write` | Create scheduling links |

**Recommended for Consultify:** `availability:read` + `event_types:read` + `invitees:read`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get current user | GET | `/users/me` |
| List event types | GET | `/event_types?user={user_uri}` |
| List scheduled events | GET | `/scheduled_events?user={user_uri}` |
| Get event invitees | GET | `/scheduled_events/{uuid}/invitees` |
| List availability | GET | `/user_availability_schedules` |

#### Webhooks

| Event | Trigger |
|-------|---------|
| `invitee.created` | Event scheduled |
| `invitee.canceled` | Event canceled |
| `routing_form_submission.created` | Form submitted |

Create webhook: `POST /webhook_subscriptions`

#### Implementation Notes

- API v1 deprecated May 2025 — use v2 only
- All resources use URIs (not IDs): `https://api.calendly.com/users/{uuid}`
- Pagination via `page_token` parameter
- Sandbox environment available for development (HTTP + localhost allowed)
- Production requires HTTPS redirect URI

---

## Category C: Task Management

### 9. Jira

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (3LO — three-legged OAuth) |
| **Developer console** | https://developer.atlassian.com/console/myapps/ |
| **API docs** | https://developer.atlassian.com/cloud/jira/platform/rest/v3/ |
| **Node.js SDK** | `npm install jira-client` or raw HTTP |
| **Base URL** | `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3` |
| **Rate limits** | ~100 requests/minute per user |

#### OAuth 2.0 (3LO) Flow

```
Authorization URL:  https://auth.atlassian.com/authorize
Token URL:          https://auth.atlassian.com/oauth/token
Accessible resources: https://api.atlassian.com/oauth/token/accessible-resources
```

**Critical step:** After getting access token, call `/oauth/token/accessible-resources` to get the `cloudId` for the user's Jira site.

#### Scopes

| Scope | Access |
|-------|--------|
| `read:jira-work` | Read issues, search, attachments, worklogs |
| `write:jira-work` | Create/update issues, comments, worklogs |
| `read:jira-user` | Read user profiles |
| `manage:jira-project` | Manage project settings |

**Recommended for Consultify:** `read:jira-work` + `write:jira-work` + `read:jira-user`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Search issues (JQL) | POST | `/rest/api/3/search` |
| Get issue | GET | `/rest/api/3/issue/{issueIdOrKey}` |
| Create issue | POST | `/rest/api/3/issue` |
| Update issue | PUT | `/rest/api/3/issue/{issueIdOrKey}` |
| List projects | GET | `/rest/api/3/project` |
| Get board sprints | GET | `/rest/agile/1.0/board/{boardId}/sprint` |

#### Implementation Notes

- All API calls go through `https://api.atlassian.com/ex/jira/{cloudId}/...`
- Access tokens expire in 1 hour; refresh tokens last 90 days
- Use `audience=api.atlassian.com` in authorization request
- JQL (Jira Query Language) for powerful issue search
- Webhooks via Jira admin or Connect app descriptors
- Keep scopes under 50 total (Atlassian recommendation)

---

### 10. Asana

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Authorization Code) |
| **Developer console** | https://app.asana.com/0/my-apps |
| **API docs** | https://developers.asana.com/docs |
| **Node.js SDK** | `npm install asana` |
| **Base URL** | `https://app.asana.com/api/1.0` |
| **Rate limits** | 1,500 requests/minute per PAT; 150 per user token |

#### OAuth 2.0 Flow

```
Authorization URL:  https://app.asana.com/-/oauth_authorize
Token URL:          https://app.asana.com/-/oauth_token
Revoke URL:         https://app.asana.com/-/oauth_revoke
```

Access tokens expire in **1 hour**. Refresh tokens provided for renewal.

#### Scopes

Asana uses a flat permission model — OAuth grants access to everything the user can access. No granular scopes.

| Scope | Access |
|-------|--------|
| `default` | Full access to user's Asana data |

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get current user | GET | `/users/me` |
| List workspaces | GET | `/workspaces` |
| List projects | GET | `/projects?workspace={gid}` |
| List tasks | GET | `/tasks?project={gid}` |
| Create task | POST | `/tasks` |
| Update task | PUT | `/tasks/{gid}` |
| Get task | GET | `/tasks/{gid}` |

#### Implementation Notes

- Official `asana` npm package with built-in OAuth support
- Webhooks: `POST /webhooks` — real-time notifications for task changes
- Pagination via `offset` parameter
- Opt-in fields: use `opt_fields` query param to select specific fields
- Alternative: Personal Access Token (PAT) for single-user/testing

---

### 11. Trello

| Property | Value |
|----------|-------|
| **Auth type** | Token-based (API Key + User Token) |
| **Developer console** | https://trello.com/power-ups/admin |
| **API docs** | https://developer.atlassian.com/cloud/trello/rest/ |
| **Node.js SDK** | No official SDK — use `axios` |
| **Base URL** | `https://api.trello.com/1` |
| **Rate limits** | 100 requests/10 seconds per API key; 300/10s per token |

#### Authorization Flow

Trello uses a **redirect-based token grant** (not standard OAuth 2.0):

```
Authorization URL: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key={API_KEY}&callback_method=fragment&return_url={REDIRECT_URI}
```

**Parameters:**
- `key` — API key from Power-Up admin
- `scope` — `read`, `write`, `account` (comma-separated)
- `expiration` — `1hour`, `1day`, `30days`, `never`
- `response_type` — `token` (returns token in URL fragment)
- `return_url` — redirect after authorization

#### Scopes

| Scope | Access |
|-------|--------|
| `read` | Read boards, lists, cards, members |
| `write` | Create/update boards, lists, cards |
| `account` | Read member email, manage Power-Ups |

**Recommended for Consultify:** `read,write`

#### Key Endpoints

All requests include `?key={API_KEY}&token={USER_TOKEN}` as query params.

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get member boards | GET | `/members/me/boards` |
| Get board lists | GET | `/boards/{id}/lists` |
| Get list cards | GET | `/lists/{id}/cards` |
| Create card | POST | `/cards` |
| Update card | PUT | `/cards/{id}` |
| Delete card | DELETE | `/cards/{id}` |

#### Implementation Notes

- No refresh tokens — token is long-lived (up to `never` expiration)
- API key is tied to a Power-Up, not a user
- Webhooks: `POST /webhooks` with `callbackURL` and `idModel`
- Tokens can be revoked by user in Trello settings
- Rate limits are per API key AND per token (both apply)

---

### 12. ClickUp

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Authorization Code) |
| **Developer console** | https://app.clickup.com/settings/apps |
| **API docs** | https://clickup.com/api |
| **Node.js SDK** | No official SDK — use `axios` |
| **Base URL** | `https://api.clickup.com/api/v2` |
| **Rate limits** | 100 requests/minute per token |

#### OAuth 2.0 Flow

```
Authorization URL:  https://app.clickup.com/api?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}
Token URL:          https://api.clickup.com/api/v2/oauth/token
```

**Token exchange body:** `application/x-www-form-urlencoded` with `client_id`, `client_secret`, `code`.

**Access tokens currently do not expire** (subject to change per ClickUp docs).

#### Scopes

ClickUp currently does **not** use granular OAuth scopes. The access token grants full access to the authorizing user's workspace data.

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get workspaces (teams) | GET | `/team` |
| Get spaces | GET | `/team/{team_id}/space` |
| Get lists | GET | `/space/{space_id}/list` |
| Get tasks | GET | `/list/{list_id}/task` |
| Create task | POST | `/list/{list_id}/task` |
| Update task | PUT | `/task/{task_id}` |
| Get task | GET | `/task/{task_id}` |

#### Implementation Notes

- Only workspace owners/admins can create OAuth apps
- No refresh token flow — token is long-lived
- Webhooks: `POST /team/{team_id}/webhook`
- Events: `taskCreated`, `taskUpdated`, `taskDeleted`, `taskStatusUpdated`
- Custom fields supported via `custom_fields` in task creation
- Pagination via `page` parameter (0-indexed)

---

### 13. Monday.com

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 |
| **Developer console** | https://monday.com/developers/apps |
| **API docs** | https://developer.monday.com/api-reference |
| **Node.js SDK** | `npm install monday-sdk-js` |
| **Base URL** | `https://api.monday.com/v2` |
| **Rate limits** | 5,000,000 complexity points/minute |

#### OAuth 2.0 Flow

```
Authorization URL:  https://auth.monday.com/oauth2/authorize
Token URL:          https://auth.monday.com/oauth2/token
```

Access token is valid until user uninstalls the app.

#### Scopes

| Scope | Access |
|-------|--------|
| `me:read` | Read current user |
| `boards:read` | Read boards |
| `boards:write` | Create/update boards and items |
| `workspaces:read` | Read workspaces |
| `users:read` | Read users |
| `updates:read` | Read updates/comments |
| `updates:write` | Post updates/comments |
| `webhooks:write` | Create webhooks |
| `account:read` | Read account info |

**Recommended for Consultify:** `me:read` + `boards:read` + `boards:write` + `users:read`

#### GraphQL API

Monday.com uses **GraphQL** (not REST). Single endpoint: `POST https://api.monday.com/v2`

```graphql
# List boards
query { boards(limit: 10) { id name state } }

# Get items from board
query { boards(ids: [123]) { items_page(limit: 50) { items { id name column_values { id text } } } } }

# Create item
mutation { create_item(board_id: 123, item_name: "New task", column_values: "{}") { id } }
```

#### Implementation Notes

- All API calls are GraphQL POST to single endpoint
- Auth header: `Authorization: {access_token}` (no "Bearer" prefix)
- Complexity-based rate limiting (not request count)
- Webhooks via `webhooks:write` scope + API mutation
- Column values are JSON-encoded strings
- `monday-sdk-js` provides client-side SDK; for server use raw GraphQL

---

### 14. Notion

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Public Integration) |
| **Developer console** | https://www.notion.so/my-integrations |
| **API docs** | https://developers.notion.com/ |
| **Node.js SDK** | `npm install @notionhq/client` |
| **Base URL** | `https://api.notion.com/v1` |
| **Rate limits** | 3 requests/second per integration |

#### OAuth 2.0 Flow

```
Authorization URL:  https://api.notion.com/v1/oauth/authorize
Token URL:          https://api.notion.com/v1/oauth/token
```

**Token exchange:** Basic Auth header with `client_id:client_secret` (base64-encoded).

Access tokens **do not expire** (until user revokes).

#### Capabilities (instead of scopes)

| Capability | Access |
|------------|--------|
| `read_content` | Read databases, pages, blocks |
| `insert_content` | Create new content |
| `update_content` | Update existing content |
| `read_comments` | Read comments |
| `insert_comments` | Add comments |
| User info: none / without email / with email | User data access level |

**Recommended for Consultify:** `read_content` + `insert_content` + `update_content` + user info with email

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Search | POST | `/search` |
| Query database | POST | `/databases/{id}/query` |
| Get page | GET | `/pages/{id}` |
| Create page | POST | `/pages` |
| Update page | PATCH | `/pages/{id}` |
| Get block children | GET | `/blocks/{id}/children` |
| Append blocks | PATCH | `/blocks/{id}/children` |

#### Implementation Notes

- Users select which pages/databases to share during OAuth (page picker)
- All requests need `Notion-Version: 2022-06-28` header
- Rich text content uses block-based structure
- Databases are like tables — query with filters and sorts
- Official `@notionhq/client` SDK handles auth and API calls
- No webhooks — must poll for changes

---

### 15. Todoist

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 |
| **Developer console** | https://developer.todoist.com/appconsole.html |
| **API docs** | https://developer.todoist.com/rest/v2 |
| **Node.js SDK** | `npm install @doist/todoist-api-typescript` |
| **Base URL** | `https://api.todoist.com/rest/v2` |
| **Rate limits** | 450 requests/15 minutes per user |

#### OAuth 2.0 Flow

```
Authorization URL:  https://todoist.com/oauth/authorize
Token URL:          https://todoist.com/oauth/access_token
```

Access tokens **do not expire**.

#### Scopes

| Scope | Access |
|-------|--------|
| `task:add` | Create tasks |
| `data:read` | Read all data |
| `data:read_write` | Read/write all data |
| `data:delete` | Delete tasks/projects |
| `project:delete` | Delete projects |

**Recommended for Consultify:** `data:read_write`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get tasks | GET | `/tasks` |
| Create task | POST | `/tasks` |
| Update task | POST | `/tasks/{id}` |
| Complete task | POST | `/tasks/{id}/close` |
| Get projects | GET | `/projects` |
| Create project | POST | `/projects` |
| Get labels | GET | `/labels` |

#### Implementation Notes

- Official TypeScript SDK: `@doist/todoist-api-typescript` (requires Node 20.18.1+)
- Sync API available for efficient incremental sync (separate from REST)
- Webhooks via app management console — events: `item:added`, `item:updated`, `item:completed`
- Natural language date parsing supported in task creation
- Sections and comments also available via API

---

### 16. Linear

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 |
| **Developer console** | https://linear.app/settings/api/applications |
| **API docs** | https://developers.linear.app/ |
| **Node.js SDK** | `npm install @linear/sdk` |
| **Base URL** | `https://api.linear.app/graphql` |
| **Rate limits** | 1,500 requests/hour for OAuth; 400 for personal tokens |

#### OAuth 2.0 Flow

```
Authorization URL:  https://linear.app/oauth/authorize
Token URL:          https://api.linear.app/oauth/token
Revoke URL:         https://api.linear.app/oauth/revoke
```

**Important:** Send token exchange params in **request body** (not URL params) — known issue with 503/400 errors otherwise.

Refresh tokens introduced April 2026 — tokens now expire and must be refreshed.

#### Scopes

| Scope | Access |
|-------|--------|
| `read` | Read all data (default) |
| `write` | Write access |
| `issues:create` | Create issues and attachments |
| `comments:create` | Create issue comments |
| `admin` | Full admin access |

**Recommended for Consultify:** `read` + `write` + `issues:create`

#### GraphQL API

Single endpoint: `POST https://api.linear.app/graphql`

```graphql
# List issues
query { issues(first: 50) { nodes { id title state { name } assignee { name } } } }

# Create issue
mutation { issueCreate(input: { title: "Bug fix", teamId: "..." }) { issue { id title } } }

# List projects
query { projects(first: 20) { nodes { id name state } } }

# List cycles
query { cycles(first: 10) { nodes { id name startsAt endsAt } } }
```

#### Implementation Notes

- Official `@linear/sdk` with strongly typed models
- GraphQL with Relay Connection spec (cursor-based pagination)
- `actor=app` parameter for service account behavior
- Webhooks: configure in Linear settings → API → Webhooks
- Events: `Issue`, `Comment`, `Project`, `Cycle` changes
- SDK handles pagination automatically

---

## Category D: Cloud Storage

### 17. Google Drive

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (same Google Cloud project as Gmail/Calendar) |
| **Developer console** | https://console.cloud.google.com/ |
| **API docs** | https://developers.google.com/drive/api/v3 |
| **Node.js SDK** | `npm install googleapis` or `npm install @googleapis/drive` |
| **Base URL** | `https://www.googleapis.com/drive/v3` |
| **Rate limits** | 12,000 queries/minute per project |

#### Scopes

| Scope | Access |
|-------|--------|
| `https://www.googleapis.com/auth/drive.file` | Files created/opened by app only |
| `https://www.googleapis.com/auth/drive.readonly` | Read all files |
| `https://www.googleapis.com/auth/drive` | Full read/write access |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | Read file metadata only |

**Recommended for Consultify:** `drive.file` (least privilege) or `drive.readonly` (for browsing)

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List files | GET | `/files?q={query}` |
| Get file metadata | GET | `/files/{fileId}` |
| Download file | GET | `/files/{fileId}?alt=media` |
| Upload file (simple) | POST | `/files?uploadType=media` |
| Upload file (resumable) | POST | `/files?uploadType=resumable` |
| Create folder | POST | `/files` (mimeType: `application/vnd.google-apps.folder`) |
| Watch for changes | POST | `/files/watch` |

#### Implementation Notes

- Shares OAuth client with Gmail and Google Calendar
- Three upload types: simple (<5MB), multipart (<5MB + metadata), resumable (>5MB)
- Changes API: `GET /changes` with `pageToken` for incremental sync
- Shared drives supported via `supportsAllDrives=true` parameter
- File search uses query language: `name contains 'report' and mimeType = 'application/pdf'`

---

### 18. OneDrive

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (same Azure AD app as Outlook/Teams) |
| **Developer console** | https://entra.microsoft.com/ |
| **API docs** | https://learn.microsoft.com/en-us/graph/api/resources/onedrive |
| **Node.js SDK** | `npm install @microsoft/microsoft-graph-client` |
| **Base URL** | `https://graph.microsoft.com/v1.0` |

#### Scopes (Delegated)

| Scope | Access |
|-------|--------|
| `Files.Read` | Read user's files |
| `Files.ReadWrite` | Read/write user's files |
| `Files.Read.All` | Read all files user can access |
| `Files.ReadWrite.All` | Read/write all files user can access |

**Recommended for Consultify:** `Files.ReadWrite` + `offline_access`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List root children | GET | `/me/drive/root/children` |
| List folder children | GET | `/me/drive/items/{item-id}/children` |
| Get file metadata | GET | `/me/drive/items/{item-id}` |
| Download file | GET | `/me/drive/items/{item-id}/content` |
| Upload small file | PUT | `/me/drive/root:/{filename}:/content` |
| Upload large file | POST | `/me/drive/items/{item-id}/createUploadSession` |
| Search files | GET | `/me/drive/root/search(q='{query}')` |

#### Implementation Notes

- Shares Azure AD app with Outlook, Calendar, and Teams
- Large file upload (>4MB): use upload sessions with byte-range chunks
- Delta queries: `GET /me/drive/root/delta` for incremental sync
- Webhook subscriptions: `POST /subscriptions` for file change notifications
- SharePoint sites accessible via `/sites/{site-id}/drive`

---

### 19. Dropbox

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 with PKCE (recommended) |
| **Developer console** | https://www.dropbox.com/developers/apps |
| **API docs** | https://www.dropbox.com/developers/documentation |
| **Node.js SDK** | `npm install dropbox` |
| **Base URL** | `https://api.dropboxapi.com/2` (RPC), `https://content.dropboxapi.com/2` (content) |
| **Rate limits** | Varies by endpoint; typically 200-1000/min |

#### OAuth 2.0 Flow with PKCE

```
Authorization URL:  https://www.dropbox.com/oauth2/authorize
Token URL:          https://api.dropboxapi.com/oauth2/token
Revoke URL:         https://api.dropboxapi.com/2/auth/token/revoke
```

**PKCE recommended** for all app types. Use `code_challenge_method=S256`.

Short-lived access tokens (4 hours) + refresh tokens.

#### Scopes

| Scope | Access |
|-------|--------|
| `account_info.read` | Read account info |
| `files.content.read` | Download files |
| `files.content.write` | Upload files |
| `files.metadata.read` | Read file/folder metadata |
| `files.metadata.write` | Modify file/folder metadata |
| `sharing.read` | Read sharing info |
| `sharing.write` | Manage sharing |

**Recommended for Consultify:** `account_info.read` + `files.content.read` + `files.content.write` + `files.metadata.read`

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List folder | POST | `/files/list_folder` |
| Continue listing | POST | `/files/list_folder/continue` |
| Get metadata | POST | `/files/get_metadata` |
| Download file | POST | `content.dropboxapi.com/2/files/download` |
| Upload file | POST | `content.dropboxapi.com/2/files/upload` |
| Upload session (large) | POST | `content.dropboxapi.com/2/files/upload_session/start` |
| Search | POST | `/files/search_v2` |

#### Implementation Notes

- Official `dropbox` npm SDK handles OAuth + PKCE
- Two API hosts: `api.dropboxapi.com` (RPC) and `content.dropboxapi.com` (file content)
- All endpoints are POST (even reads) — parameters in JSON body
- File paths start with `/` (e.g., `/Documents/report.pdf`)
- Longpoll for changes: `POST /files/list_folder/longpoll`
- Cursor-based pagination for folder listing

---

### 20. Box

| Property | Value |
|----------|-------|
| **Auth type** | OAuth 2.0 (Authorization Code) |
| **Developer console** | https://app.box.com/developers/console |
| **API docs** | https://developer.box.com/reference |
| **Node.js SDK** | `npm install box-node-sdk` |
| **Base URL** | `https://api.box.com/2.0` |
| **Rate limits** | 1,000 API calls/minute per user |

#### OAuth 2.0 Flow

```
Authorization URL:  https://account.box.com/api/oauth2/authorize
Token URL:          https://api.box.com/oauth2/token
Revoke URL:         https://api.box.com/oauth2/revoke
```

Access tokens expire in **60 minutes**. Refresh tokens expire in **60 days** (or single-use).

#### Scopes

| Scope | Access |
|-------|--------|
| `root_readonly` | Read all files and folders |
| `root_readwrite` | Read/write files and folders |
| `manage_managed_users` | Manage users (admin) |
| `manage_webhooks` | Create/manage webhooks |

**Recommended for Consultify:** `root_readwrite`

Scopes can be downscoped at authorization time by appending `?scope=root_readonly` to auth URL.

#### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get current user | GET | `/users/me` |
| List folder items | GET | `/folders/{id}/items` |
| Get file info | GET | `/files/{id}` |
| Download file | GET | `/files/{id}/content` |
| Upload file | POST | `https://upload.box.com/api/2.0/files/content` |
| Upload new version | POST | `https://upload.box.com/api/2.0/files/{id}/content` |
| Search | GET | `/search?query={query}` |
| Create folder | POST | `/folders` |

#### Implementation Notes

- Official `box-node-sdk` handles auth, token refresh, and API calls
- Upload endpoint is different host: `upload.box.com`
- Chunked upload for large files (>50MB)
- Webhooks: `POST /webhooks` — events: `FILE.UPLOADED`, `FILE.DOWNLOADED`, etc.
- Box supports metadata templates for custom file properties
- Events API: `GET /events` for enterprise event stream
- Credentials in `.env` must be quoted strings (common gotcha)

---

## Cross-Cutting Implementation Patterns

### Shared OAuth Infrastructure

Several providers share the same developer platform:

| Platform | Apps sharing one registration |
|----------|-------------------------------|
| **Google Cloud** | Gmail, Google Calendar, Google Drive |
| **Microsoft Entra (Azure AD)** | Outlook, Outlook Calendar, Teams, OneDrive |
| **Atlassian** | Jira, Trello (separate auth flows but same developer console) |

### Token Storage Schema

All connectors store tokens in the same structure:

```sql
CREATE TABLE user_integration_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  connector_id  TEXT NOT NULL,          -- e.g. 'gmail', 'jira', 'slack'
  access_token  TEXT NOT NULL,          -- encrypted at rest
  refresh_token TEXT,                   -- encrypted at rest (nullable for non-expiring tokens)
  token_type    TEXT DEFAULT 'Bearer',
  expires_at    TIMESTAMPTZ,            -- NULL if token doesn't expire
  scopes        TEXT,                   -- space-separated granted scopes
  extra_data    JSONB,                  -- cloudId (Jira), workspace_id (Slack), etc.
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, connector_id)
);
```

### Token Refresh Strategy

| Pattern | Connectors |
|---------|-----------|
| **Standard refresh** (access expires ~1h, refresh long-lived) | Gmail, Google Calendar, Google Drive, Outlook, Teams, OneDrive, Jira, Asana, Calendly, Linear, Box |
| **Short-lived + PKCE refresh** (access ~4h) | Dropbox |
| **Non-expiring access token** | Slack (bot), ClickUp, Notion, Todoist, Monday.com |
| **Non-expiring user token** | Trello |
| **App-specific password** (no token) | Apple Calendar |

### Webhook Delivery

| Pattern | Connectors |
|---------|-----------|
| **Graph subscriptions** | Outlook, Teams, OneDrive, Outlook Calendar |
| **Pub/Sub + watch** | Gmail, Google Calendar, Google Drive |
| **Native webhooks API** | Slack, Jira, Asana, ClickUp, Monday.com, Todoist, Linear, Calendly, Box |
| **Trello webhooks** | Trello |
| **Longpoll** | Dropbox |
| **Polling only** | Notion, Apple Calendar |

---

## Environment Variables Required

```env
# Google (Gmail, Calendar, Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Microsoft (Outlook, Calendar, Teams, OneDrive)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=
MICROSOFT_TENANT_ID=common

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_STATE_SECRET=
SLACK_REDIRECT_URI=

# Jira (Atlassian)
ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=
ATLASSIAN_REDIRECT_URI=

# Asana
ASANA_CLIENT_ID=
ASANA_CLIENT_SECRET=
ASANA_REDIRECT_URI=

# Trello
TRELLO_API_KEY=
TRELLO_REDIRECT_URI=

# ClickUp
CLICKUP_CLIENT_ID=
CLICKUP_CLIENT_SECRET=
CLICKUP_REDIRECT_URI=

# Monday.com
MONDAY_CLIENT_ID=
MONDAY_CLIENT_SECRET=
MONDAY_REDIRECT_URI=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
NOTION_REDIRECT_URI=

# Todoist
TODOIST_CLIENT_ID=
TODOIST_CLIENT_SECRET=
TODOIST_REDIRECT_URI=

# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_REDIRECT_URI=

# Calendly
CALENDLY_CLIENT_ID=
CALENDLY_CLIENT_SECRET=
CALENDLY_REDIRECT_URI=

# Dropbox
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
DROPBOX_REDIRECT_URI=

# Box
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_REDIRECT_URI=
```

**Total unique developer registrations needed: 12**
(Google, Microsoft, Slack, Atlassian, Asana, Trello, ClickUp, Monday, Notion, Todoist, Linear, Calendly, Dropbox, Box — but Google covers 3 apps and Microsoft covers 4 apps)

---

## npm Dependencies Summary

```json
{
  "googleapis": "Gmail + Google Calendar + Google Drive",
  "@azure/msal-node": "Microsoft auth (Outlook, Calendar, Teams, OneDrive)",
  "@microsoft/microsoft-graph-client": "Microsoft Graph API calls",
  "@slack/web-api": "Slack API calls",
  "@slack/oauth": "Slack OAuth flow",
  "@notionhq/client": "Notion API",
  "@doist/todoist-api-typescript": "Todoist API",
  "@linear/sdk": "Linear API",
  "box-node-sdk": "Box API",
  "dropbox": "Dropbox API",
  "asana": "Asana API",
  "tsdav": "CalDAV (Apple Calendar)",
  "axios": "HTTP client for Trello, ClickUp, Monday, Calendly, Jira"
}
```
