# Content Module User Guide

## Introduction

The Content Module in Consultify provides enterprise-level management for two main content types:

1. **Email Templates** - Reusable email designs with variable substitution
2. **AI Playbook Templates** - Multi-step action plans for AI-driven workflows

This guide covers how to use the Content Module effectively.

---

## Getting Started

### Accessing the Content Module

1. Log in to Consultify as an Admin or SuperAdmin
2. Navigate to **SuperAdmin** → **Content** in the main menu
3. Select the content type you want to manage:
   - Email Templates
   - Playbook Templates
   - Categories & Tags
   - Analytics Dashboard

---

## Email Templates

### Overview

Email templates allow you to create reusable email designs with dynamic variables. Templates support:

- **Variables** - Dynamic placeholders like `{{userName}}`
- **Multi-language** - Create templates in different languages
- **Versioning** - Track changes and restore previous versions
- **Status workflow** - DRAFT → PUBLISHED → DEPRECATED

### Creating an Email Template

1. Go to **Content** → **Email Templates**
2. Click **Create Template**
3. Fill in the required fields:
   - **Template Key** - Unique identifier (e.g., `welcome-email`)
   - **Name** - Display name
   - **Subject** - Email subject line (supports variables)
   - **HTML Content** - Rich HTML email body
   - **Text Content** - Plain text fallback
4. Define available variables in the **Variables Schema**
5. Click **Save as Draft**

### Using Variables

Variables are placeholders that get replaced with actual values when the email is sent.

**Syntax:** `{{variableName}}`

**Example:**

```html
<p>Hello {{userName}},</p>
<p>Your order #{{orderNumber}} has been shipped!</p>
<p><a href="{{trackingLink}}">Track your order</a></p>
```

### Variable Schema

Define expected variables with JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "userName": { "type": "string", "description": "User's name" },
    "orderNumber": { "type": "string", "description": "Order ID" },
    "trackingLink": { "type": "string", "format": "url" }
  },
  "required": ["userName", "orderNumber"]
}
```

### Previewing Templates

1. Open an email template
2. Click **Preview**
3. Enter test data in the preview modal
4. View how the email will appear with real data

### Sending Test Emails

1. Open an email template
2. Click **Send Test**
3. Enter recipient email addresses
4. Provide test data for variables
5. Click **Send**

### Publishing Workflow

Templates follow a status workflow:

| Status | Description |
|--------|-------------|
| **DRAFT** | Work in progress, not available for use |
| **PUBLISHED** | Active and available for sending |
| **DEPRECATED** | No longer recommended, still viewable |

**To publish:**
1. Open a DRAFT template
2. Click **Publish**
3. Confirm the action

**To deprecate:**
1. Open a PUBLISHED template
2. Click **Deprecate**
3. Confirm the action

### Version History

Every change creates a new version. To view history:

1. Open a template
2. Click the **Versions** tab
3. View all previous versions
4. Click **Restore** to revert to a previous version

---

## Playbook Templates

### Extended Features

In addition to the visual editor, playbook templates now support:

- **Comments** - Collaborate with team members
- **Reviews** - Formal approval workflow
- **Analytics** - Usage statistics and success rates
- **Version History** - Track and restore changes
- **Cloning** - Create copies for modification

### Comments

Comments enable team collaboration on playbooks.

**Adding a comment:**
1. Open a playbook template
2. Go to the **Comments** tab
3. Type your comment
4. Click **Post**

**Replying to comments:**
1. Click **Reply** on any comment
2. Type your response
3. Click **Post**

**Resolving comments:**
- Click **Resolve** to mark a comment as addressed
- Resolved comments can be hidden using the filter

**Mentioning users:**
- Type `@` followed by a name to mention someone
- They'll receive a notification

### Reviews

Reviews provide formal approval before publishing.

**Requesting a review:**
1. Open a playbook template
2. Go to the **Reviews** tab
3. Click **Request Review**
4. Select a reviewer
5. Set priority and due date
6. Add checklist items if needed
7. Submit the request

**Reviewing a playbook:**
1. Go to **Content** → **Pending Reviews**
2. Open the review
3. Check the playbook content
4. Complete checklist items
5. Choose an action:
   - **Approve** - Ready for publishing
   - **Request Changes** - Needs modifications
   - **Reject** - Not suitable

### Analytics

Track how playbooks are performing:

1. Open a playbook template
2. Go to the **Analytics** tab
3. View metrics:
   - Total runs
   - Success rate
   - Average duration
   - Unique users
   - Usage over time

---

## Categories & Tags

### Categories

Categories provide hierarchical organization.

**Creating a category:**
1. Go to **Content** → **Categories**
2. Click **Create Category**
3. Enter name and description
4. Select content type (Playbook, Email, or All)
5. Choose a parent category (optional)
6. Set color and icon
7. Save

**Category Types:**
- **ALL** - Available for both playbooks and emails
- **PLAYBOOK** - Only for playbook templates
- **EMAIL** - Only for email templates

### Tags

Tags provide flexible labeling.

**Creating a tag:**
1. Go to **Content** → **Tags**
2. Click **Create Tag**
3. Enter name
4. Choose a color
5. Save

**Adding tags to content:**
1. Open a template
2. Find the Tags section
3. Click **Add Tag**
4. Select from available tags

---

## Search & Filtering

### Global Search

Search across all content types:

1. Use the search bar at the top of the Content module
2. Enter your search term
3. Filter by:
   - Content type
   - Status
   - Category
   - Tags
4. Sort by relevance, date, or name

### Advanced Filters

On any list view, use filters to narrow results:

- **Status** - DRAFT, PUBLISHED, DEPRECATED
- **Category** - Filter by category
- **Date Range** - Created or updated within period
- **Created By** - Filter by author

---

## Favorites

Save frequently used content for quick access.

**Adding to favorites:**
1. Click the star icon on any template
2. Optionally add notes and folder name

**Viewing favorites:**
1. Go to **Content** → **Favorites**
2. Filter by content type or folder
3. Click to open any favorite

---

## Bulk Actions

Perform actions on multiple items at once.

**Available bulk actions:**
- Publish
- Deprecate
- Add tags
- Remove tags
- Change category
- Delete

**Using bulk actions:**
1. Select items using checkboxes
2. The bulk action bar appears at the bottom
3. Click the desired action
4. Confirm when prompted

---

## Permissions

Access is controlled by role-based permissions:

| Role | Capabilities |
|------|--------------|
| **SuperAdmin** | Full access to all features |
| **Admin** | Create, edit, publish, manage categories/tags |
| **Project Manager** | View, create playbooks, comment |
| **Team Member** | View content, add comments |
| **Viewer** | View-only access |

---

## Best Practices

### Email Templates

1. **Use descriptive keys** - `welcome-user-v2` not `email-1`
2. **Document variables** - Include descriptions in schema
3. **Test before publishing** - Always send test emails
4. **Keep plain text** - Provide text fallback for accessibility
5. **Version wisely** - Add change notes when updating

### Playbook Templates

1. **Add comments** - Explain complex steps
2. **Use reviews** - Get approval before publishing
3. **Track analytics** - Monitor success rates
4. **Categorize properly** - Use categories for organization
5. **Tag consistently** - Use standard tags across content

### Organization

1. **Plan categories** - Create a logical hierarchy
2. **Use tags sparingly** - Too many tags reduces usefulness
3. **Archive old content** - Deprecate instead of deleting
4. **Regular reviews** - Schedule content audits

---

## Troubleshooting

### Template Not Sending

- Check if template is PUBLISHED
- Verify variable data is provided
- Check email service configuration
- Review error logs

### Cannot Edit Template

- Check if you have edit permissions
- Template may be locked by another user
- Template may be in review

### Analytics Not Showing

- Wait for data to populate (may take up to 24 hours)
- Check date range filter
- Verify analytics permissions

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save template |
| `Ctrl+P` / `Cmd+P` | Preview |
| `Ctrl+Shift+P` | Publish |
| `Esc` | Close modal |

---

## Getting Help

- **Documentation** - This guide and API docs
- **Support** - Contact support@consultify.app
- **Community** - Join our Slack channel




