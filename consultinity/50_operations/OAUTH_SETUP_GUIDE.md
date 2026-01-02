# 🔐 OAuth Setup Guide - Consultify

This guide provides detailed instructions for configuring Google OAuth and LinkedIn OAuth authentication for the Consultify application.

## Current Status

✅ OAuth implementation is complete in the codebase  
❌ OAuth credentials need to be configured

## Quick Start

The application requires OAuth credentials to be added to your `.env` file:

```bash
# OAuth: Google
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3005/api/auth/google/callback

# OAuth: LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
LINKEDIN_CALLBACK_URL=http://localhost:3005/api/auth/linkedin/callback
```

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `Consultify`
4. Click **"Create"**

### Step 2: Enable Required APIs

1. Navigate to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click **"Enable"**

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type → **"Create"**
3. Fill in application information:
   - **App name**: `Consultify`
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **"Save and Continue"**
5. On **Scopes** page → **"Add or Remove Scopes"**
6. Select the following scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
7. **"Save and Continue"**
8. Add test users (for development): Add email addresses that can test OAuth
9. **"Save and Continue"**

### Step 4: Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Application type: **"Web application"**
4. Name: `Consultify Web App`
5. **Authorized redirect URIs**:
   - Development: `http://localhost:3005/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Click **"Create"**
7. **📋 Copy the Client ID and Client Secret**

### Step 5: Add to .env

```bash
GOOGLE_CLIENT_ID=<paste Client ID from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<paste Client Secret from Google Cloud Console>
GOOGLE_CALLBACK_URL=http://localhost:3005/api/auth/google/callback
```

---

## LinkedIn OAuth Setup

### Step 1: Create LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Sign in with your LinkedIn account
3. Click **"Create app"**
4. Fill in required information:
   - **App name**: `Consultify`
   - **LinkedIn Page**: Select or create a company page
   - **App logo**: Upload your application logo (min 100x100px)
   - **Legal agreement**: Check the box
5. Click **"Create app"**

### Step 2: Configure OAuth Settings

1. In your app dashboard → **"Auth"** tab
2. Under **"OAuth 2.0 settings"**
3. **Redirect URLs** → Add:
   - Development: `http://localhost:3005/api/auth/linkedin/callback`
   - Production: `https://yourdomain.com/api/auth/linkedin/callback`
4. Click **"Update"**

### Step 3: Request API Access

1. Go to **"Products"** tab
2. Find **"Sign In with LinkedIn using OpenID Connect"**
3. Click **"Request access"**
4. Wait for approval (usually instant for development apps)

### Step 4: Get Credentials

1. Return to **"Auth"** tab
2. Find your credentials:
   - **Client ID**
   - **Client Secret** (click "Show" to reveal)
3. **📋 Copy both values**

### Step 5: Add to .env

```bash
LINKEDIN_CLIENT_ID=<paste Client ID from LinkedIn>
LINKEDIN_CLIENT_SECRET=<paste Client Secret from LinkedIn>
LINKEDIN_CALLBACK_URL=http://localhost:3005/api/auth/linkedin/callback
```

---

## Verification

### Check OAuth Status

After configuring credentials and restarting the server:

```bash
curl http://localhost:3005/api/auth/oauth/status
```

**Expected response:**
```json
{
  "google": {
    "configured": true,
    "loginUrl": "/api/auth/google"
  },
  "linkedin": {
    "configured": true,
    "loginUrl": "/api/auth/linkedin"
  }
}
```

### Check Server Logs

Look for these messages in your server logs:

```
✅ [OAuth] Google OAuth strategy configured
✅ [OAuth] LinkedIn OAuth strategy configured
```

If not configured, you'll see:
```
⚠️ [OAuth] Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)
⚠️ [OAuth] LinkedIn OAuth not configured (missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET)
```

### Test OAuth Flows

#### Google Login Test

1. Open `http://localhost:3000`
2. Click **"Continue with Google"** button
3. Select a Google account
4. Grant permissions
5. You should be redirected back and logged in ✅

#### LinkedIn Login Test

1. Open `http://localhost:3000`
2. Click **"Continue with LinkedIn"** button
3. Enter LinkedIn credentials
4. Grant permissions
5. You should be redirected back and logged in ✅

---

## Production Deployment

### Important: Update Callback URLs

Before deploying to production:

1. **Google Cloud Console**:
   - Add production callback URL: `https://yourdomain.com/api/auth/google/callback`
   - Publish OAuth consent screen (remove from testing mode)

2. **LinkedIn Developer Portal**:
   - Add production callback URL: `https://yourdomain.com/api/auth/linkedin/callback`
   - Verify app is approved

3. **Production Environment Variables**:
   ```bash
   GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
   LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/auth/linkedin/callback
   FRONTEND_URL=https://yourdomain.com
   ```

---

## Troubleshooting

### ⚠️ "Google OAuth not configured"

**Cause:** Missing environment variables  
**Solution:** 
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in `.env`
- Restart the development server

### ⚠️ "Redirect URI mismatch"

**Cause:** Callback URL in OAuth provider doesn't match `.env`  
**Solution:**
- Ensure callback URLs in Google/LinkedIn settings exactly match your `.env` values
- No trailing slashes, exact protocol (http/https)

### ⚠️ "invalid_scope" (LinkedIn)

**Cause:** Missing product access  
**Solution:**
- Go to LinkedIn app → "Products" tab
- Request access to "Sign In with LinkedIn using OpenID Connect"
- Wait for approval

### ⚠️ "Access blocked: This app's request is invalid"

**Cause:** Google OAuth consent screen not configured properly  
**Solution:**
- Complete all steps in OAuth consent screen setup
- Add test users in development
- Ensure scopes are configured

---

## Security Best Practices

🔒 **Never commit** `.env` files to git  
🔒 Store secrets securely in production (use secret management)  
🔒 Regularly rotate OAuth credentials  
🔒 Monitor OAuth usage and implement rate limiting  
🔒 Use HTTPS in production

---

## Architecture Reference

The OAuth implementation consists of:

- **Frontend**: [`views/AuthView.tsx`](file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/views/AuthView.tsx) - Login buttons
- **Frontend**: [`views/OAuthCallback.tsx`](file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/views/OAuthCallback.tsx) - Handles OAuth redirects
- **Backend**: [`server/routes/oauthRoutes.js`](file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/routes/oauthRoutes.js) - OAuth strategies
- **Backend**: [`server/services/oauthService.js`](file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/services/oauthService.js) - User creation logic
- **Config**: [`server/config.js`](file:///Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/server/config.js) - Environment variables

---

## Need Help?

- Check server logs for detailed error messages
- Verify all environment variables are set
- Ensure callback URLs match exactly
- Test with test users first before going public

**OAuth is fully implemented** - you just need to add the credentials! 🚀
