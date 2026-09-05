# R5 — governed cloud OAuth: brief i diff nienałożony

## Pomiar

`server/src/services/v8/pmSyncExternalAuthMaterializationService.ts:241-344` buduje prawdziwe URL-e wyłącznie dla `jira`, `gmail`, `asana`, `teams`, `slack`. Dla `google_drive`, `onedrive`, `dropbox` wykonuje fallback `authUrl: callbackUrl`.

Świeży kontrakt przez realny `ApiGateway` i JWT na PostgreSQL dał jednak wynik wcześniejszy i bardziej restrykcyjny:

```text
DAY369_GOVERNED_CONNECT_HTTP 500 {}
expected 500 to be 200
```

Zatem w środowisku dyżuru nie potwierdzono udanej odpowiedzi z atrapą URL. Statyczny fallback istnieje, ale publiczna trasa kończy się `500` przed dostarczeniem `authUrl`. Test kontrolny nie został osłabiony ani zacommitowany jako zielony.

## Diff nienałożony — szkic osobnego dyżuru

```diff
--- a/server/src/services/v8/pmSyncExternalAuthMaterializationService.ts
+++ b/server/src/services/v8/pmSyncExternalAuthMaterializationService.ts
@@
+  if (normalizeConnectorId(context.connectorId) === 'google_drive') {
+    const params = new URLSearchParams({
+      client_id: getGoogleClientId(),
+      redirect_uri: callbackUrl,
+      response_type: 'code',
+      scope: 'https://www.googleapis.com/auth/drive.file',
+      state: session.state,
+      access_type: 'offline',
+      prompt: 'consent',
+    });
+    return {
+      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
+      callbackUrl,
+      state: session.state,
+      expiresAt: new Date(session.expiresAt).toISOString(),
+    };
+  }
@@
-  return ['jira', 'gmail', 'asana', 'teams', 'slack'].includes(normalizeConnectorId(connectorId));
+  return ['jira', 'gmail', 'google_drive', 'asana', 'teams', 'slack'].includes(normalizeConnectorId(connectorId));
```

To tylko ilustracja rozmiaru (około 20–30 linii dla Google Drive plus testy i audit trail). Nie została nałożona. OneDrive i Dropbox wymagają analogicznych, osobno testowanych gałęzi.
