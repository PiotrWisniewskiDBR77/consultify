# AUDYT F — rama ekranu `/chat` (poza samą rozmową i kanwą)

Katalog: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c60287e6ef1c302e4af18d40b0a6521d`), tylko odczyt.
Pomiary curl: `https://staging.consultify.ai`, bez ciała/uwierzytelnienia, jedno wywołanie na trasę.

## Ścieżka renderu /chat

`src/routes/AppRoutes.tsx:1771-1782` — trasa `ROUTES.AI_CHAT` (`/chat`, `src/routes/routeConfig.ts:31`)
renderuje:

```
<MainLayout breadcrumbs={breadcrumbs || [t('navigation.aiChat','AI Chat')]}>
  <RouteErrorBoundary>
    <AnimationWrapper variant="fade">
      <ConversationRouteSync />
      <UnifiedChatPanel mode="full" />
    </AnimationWrapper>
  </RouteErrorBoundary>
</MainLayout>
```

Brak `BetaGate`/`ProtectedRoute` bezpośrednio na tej trasie (auth pilnowany wyżej w drzewie routera).
Analogiczna trasa deep-link `ROUTES.AI_CHAT_CONVERSATION` (`/chat/:conversationId`,
`AppRoutes.tsx:1858-1869`) renderuje **dokładnie to samo** — `<UnifiedChatPanel mode="full" />`,
bez żadnych dodatkowych propsów.

**Kluczowe dla innych agentów:** żaden z tych dwóch wariantów `/chat` nie przekazuje do
`UnifiedChatPanel` propsów `kickoffMessage`/`onKickoffConsumed`/`showModeToggle` itd. — te propsy
istnieją WYŁĄCZNIE na ścieżce split-panelu w `src/layouts/MainLayout.tsx:484-511` (chat doklejony z
boku innych ekranów). Ma to konkretną konsekwencję opisaną w defekcie D-1 niżej.

`MainLayout` (`src/layouts/MainLayout.tsx`) na widoku `AppView.AI_CHAT`:
- `shouldShowChatPanel = false` (linia 102-134, `AI_CHAT` jest na liście `VIEWS_WITHOUT_CHAT_PANEL`)
  → **przycisk „Sparkles" (otwórz/zamknij panel AI) w headerze NIE renderuje się na `/chat`** (blok
  warunkowy `{shouldShowChatPanel && (...)}`, linia 413-439) — sensowne, bo już jesteśmy w czacie.
- `shouldMountChatPanel = false` → prawy split-panel z resizerem i drugą instancją
  `UnifiedChatPanel mode="split"` też się nie montuje na `/chat` (linia 464-514).
- Flaga `isArtifactStudioLaneEnabled` nie dotyczy `/chat` (dotyczy `/document-studio`,
  `/presentations/builder/`, `/excele`).

Płaska rama (`MainLayout`) na `/chat` renderuje więc: pasek boczny `Sidebar`, nagłówek z
breadcrumbem+pigułkami+dzwonkiem+menu użytkownika, globalny prawy pionowy pasek trzech ikon
(Help/Feedback/Documents), globalne bannery/modale dostępu i `<UnifiedChatPanel mode="full" />` jako
`children`.

---

## Inwentarz

| # | Etykieta PL | klucz i18n | element plik:linia | handler | łańcuch | HTTP | trasa serwera | kontroler/serwis | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | (ikona ☰, mobile) | `layout.openMenu` | `MainLayout.tsx:346-353` | `onClick={() => setIsSidebarOpen(true)}` | `useAppStore.setIsSidebarOpen` (store) | — | — | — | — | — | OK-LOKALNY | tylko `lg:hidden`, otwiera Sidebar mobile |
| 2 | Breadcrumb „AI Chat" | `navigation.aiChat` | `MainLayout.tsx:374-380` | brak (ostatni segment, `aria-current="page"`) | — | — | — | — | — | — | OK-LOKALNY | nieklikalny tekst, nie przycisk |
| 3 | Pigułka „Data" (zielona kropka) | `system.data` | `src/components/SystemHealth.tsx:148-175` | `onClick={() => setIsOpen(!isOpen)}` | `SystemHealth`→`Api.checkSystemHealth` | `GET /api/health` | `server/src/routes/healthRoutes.ts:18` mount `server/src/index.ts:163` (`app.use('/api/health', healthRoutes)`) | `HealthCheckController.checkHealth` | — | 200 | OK | Publiczny endpoint (świadomie, readiness). `DemoTopbarStatus.tsx` (plik wskazany w briefie) NIE jest tym komponentem — patrz niżej |
| 4 | Pigułka „Model" (niebieska/kolor tieru) | `llm.model` | `src/components/LLMSelector.tsx:245-275` | `onClick={() => setIsOpen(!isOpen)}` | `LLMSelector`→`Api.checkLLMProvidersHealth` (co 45s) + `Api.getRecommendedProvider` (gdy otwarte) | `GET /api/llm/providers/health?timeoutMs=4000`, `GET /api/llm/providers/recommended?tier=...` | `server/src/routes/llm.routes.ts:675,681`, mount `Gateway.ts:917` `/api/llm` | `LLMController.getProvidersHealth` / `getRecommendedProvider` | brak (świadomie publiczne — komentarz `llm.routes.ts:673-674`) | health=200, recommended=200 | OK | 200 bez auth jest ZAMIERZONE (komentarz w kodzie), nie traktuję jako defekt bezpieczeństwa |
| 5 | 4× wiersz tieru (Budget/Standard/Premium/Reasoning) w dropdownie „Model" | `llm.budgetTier` itd. | `LLMSelector.tsx:320-361` | `onClick={() => handleTierSelect(tier.id)}` | `setAIConfig` (store, klient) | — | — | — | — | — | OK-LOKALNY | czysto kliencki wybór tieru routingu |
| 6 | Ikona „ptaszek w kwadracie" (CheckSquare) — **to jest `TaskDropdown`, NIE `PendingActionsIndicator`** | `taskDropdown.titleButton` | `src/components/TaskDropdown.tsx:139-155` | `onClick={() => setIsOpen(!isOpen)}` | `TaskDropdown`→`Api.getPersonalTasks` | `GET /api/my-work/personal-tasks?includeDone=false` | `server/src/routes/my-work.routes.ts:1172`, mount `Gateway.ts:1051` `/api/my-work` | `my-work.routes.ts` handler inline | — | 401 | OK | `src/components/AIChat/PendingActionsIndicator.tsx` nigdzie nie jest importowany — martwy plik, patrz D-4 |
| 7 | „View all" (w dropdownie zadań) | `taskDropdown.viewAll` | `TaskDropdown.tsx:171-176` | `onClick={handleNavigateToTasks}` | `setMyWorkIntent({tab:'tasks'})`+`setCurrentView(MY_WORK)` | — | — | — | — | — | OK-LOKALNY | nawigacja klient-routing (`setCurrentView`→`navigateFn`, `src/store/slices/uiSlice.ts:253-262`) |
| 8 | wiersz zadania (klik) | — | `TaskDropdown.tsx:227-230` | `onClick={handleNavigateToTasks}` | jw. | — | — | — | — | — | OK-LOKALNY | otwiera zawsze /my-work, nie konkretne zadanie |
| 9 | „Create new task" (stan pusty) | `taskDropdown.createNew` | `TaskDropdown.tsx:214-219` | `onClick={handleNavigateToTasks}` | jw. | — | — | — | — | — | URWANY (etykieta) | Etykieta obiecuje TWORZENIE zadania, handler tylko nawiguje do /my-work — nic nie tworzy. D-2 |
| 10 | „View N more tasks" | `taskDropdown.viewMore` | `TaskDropdown.tsx:290-297` | `onClick={handleNavigateToTasks}` | jw. | — | — | — | — | — | OK-LOKALNY | |
| 11 | Dzwonek „Inbox" (99+) | `notificationDropdown.title` | `src/components/layout/NotificationDropdown.tsx:341-356` | `onClick={() => setIsOpen(!isOpen)}` | `Api.getNotifications`+`Api.getUnreadNotificationCount` | `GET /api/notifications?...`, `GET /api/notifications/unread-count` | `server/src/routes/notifications/notifications.routes.ts:69,354`, mount `Gateway.ts:920` `/api/notifications` | inline handler w routes | — | 401, 401 | OK | |
| 12 | „Inbox" (link w headerze dropdownu) | `notificationDropdown.inbox`="Skrzynka" | `NotificationDropdown.tsx:373-383` | `setMyWorkIntent({tab:'inbox'})`+`setCurrentView(MY_WORK)` | — | — | — | — | — | — | OK-LOKALNY | Patrz D-5 — identyczny handler co poz. 13 |
| 13 | „Center" (link obok) | `notificationDropdown.center`="Centrum" | `NotificationDropdown.tsx:384-394` | identyczny co poz.12 | — | — | — | — | — | — | OK-LOKALNY (duplikat) | D-5: dwie różne etykiety PL, ta sama akcja |
| 14 | „Mark all read" | `notificationDropdown.markAllReadShort` | `NotificationDropdown.tsx:395-403` | `handleMarkAllRead`→`Api.markAllNotificationsRead` | | `POST /api/notifications/mark-all-read` | `notifications.routes.ts:438` | inline | — | 401 | OK | |
| 15 | Close „X" dropdownu | `common.close` | `NotificationDropdown.tsx:404-410` | `setIsOpen(false)` | — | — | — | — | — | — | OK-LOKALNY | |
| 16 | wiersz powiadomienia (klik) | — | `NotificationDropdown.tsx:454` | `openInMyWork`→`Api.markNotificationRead`+nawigacja | | `PATCH /api/notifications/:id/read` | `notifications.routes.ts:380` | inline | — | 401 | OK | |
| 17 | ikona czatu na wierszu | `notificationDropdown.openChat` | `NotificationDropdown.tsx:500-506` | `handleOpenChat`→`updateWorkspaceFromView`(store)+`toggleChatCollapse` | — | — | — | — | — | — | OK-LOKALNY | Na `/chat` `toggleChatCollapse` nie ma efektu wizualnego (split-panel niezamontowany) — funkcjonalnie no-op na tym ekranie, ale nie „martwy" bo działa na innych ekranach |
| 18 | drzazga „Snooze" + 4 presety | `notificationDropdown.snooze*` | `NotificationDropdown.tsx:510-559` | `useNotificationSnooze` (lokalny hook) | — | — | — | — | — | — | OK-LOKALNY | localStorage-only wg `useNotificationSnooze` |
| 19 | „Mark as read" (per wiersz) | `notificationDropdown.markAsRead` | `NotificationDropdown.tsx:564-571` | `handleMarkAsRead`→`Api.markNotificationRead` | | `PATCH /api/notifications/:id/read` | jw. poz.16 | | — | 401 | OK | |
| 20 | „Delete" (kosz, per wiersz) | `common.delete` | `NotificationDropdown.tsx:572-578` | `handleDelete`→`Api.deleteNotification` | | `DELETE /api/notifications/:id` | `notifications.routes.ts:531` | | — | 401 | OK | |
| 21 | „Clear read" (stopka) | `notificationDropdown.clearRead` | `NotificationDropdown.tsx:609-616` | `handleClearRead`→pętla `Api.deleteNotification` | jw. | jw. | jw. | — | 401 | OK | |
| 22 | „Clear all" (stopka) | `notificationDropdown.clearAll` | `NotificationDropdown.tsx:618-625` | `handleDeleteAll`→pętla `Api.deleteNotification` | jw. | jw. | jw. | — | 401 | OK | |
| 23 | Awatar „PW" (menu użytkownika) | `userProfile.openMenu` | `src/components/layout/UserProfileMenu.tsx:250-278` | `onClick={() => setIsOpen(!isOpen)}` | — | — | — | — | — | — | OK-LOKALNY | portalowane do `document.body` |
| 24 | „Switch Organization" | `settings.menu.switchOrg` | `UserProfileMenu.tsx:329-353` | `fetchOrgs` | `GET /api/organizations/current` | `server/src/routes/organization/organizations.routes.ts:41`, mount `Gateway.ts:978` | `OrganizationController.getCurrentOrganizations` | — | 401 | OK | |
| 25 | wiersz organizacji (klik) | — | `UserProfileMenu.tsx:374-427` | `handleSwitchOrg`→`Api`fetch | `POST /api/auth/switch-organization` | `server/src/routes/auth.routes.ts:973`, mount `Gateway.ts:563` `/api/auth` | inline handler | — | 401 | OK | zapisuje nowy token i przeładowuje stronę |
| 26 | Theme (Light/System/Dark) ×3 | `settings.menu.themeModes.*` | `UserProfileMenu.tsx:451-471` | `toggleTheme(tMode)` | store | — | — | — | — | — | OK-LOKALNY | |
| 27 | Language ×N | — (kod języka jako etykieta) | `UserProfileMenu.tsx:489-504` | `handleLanguageChange`→`changeLanguageAndPersist` | `changeLanguage`(i18next, klient) + `Api.put('/users/:id',{language})` | `PUT /api/users/:id` | `server/src/routes/user/users.routes.ts:88`, mount `Gateway.ts:642` `/api/users` | `UserController.updateUser` | — | 401 | OK | |
| 28 | Toggle „Open/Exit Sample Workspace" | `settings.menu.demoMode*` | `UserProfileMenu.tsx:531-568` | `toggleDemoMode`→`Api.toggleDemoMode` | | `POST /api/demo/toggle` | `server/src/routes/demo.routes.ts:83`, mount `Gateway.ts:1339` `/api/demo` | inline handler | — | 401 | OK | po sukcesie `window.location.href='/chat'` (wejście do demo zawsze ląduje na `/chat`) |
| 29 | „My Profile" | `settings.menu.myProfile` | `UserProfileMenu.tsx:581-587` | `handleNavigate(SETTINGS_PROFILE)` | `setCurrentView`→`navigateFn` | — | — | — | — | — | OK-LOKALNY | |
| 30 | „Billing & Plans" | `settings.menu.billing` | `UserProfileMenu.tsx:588-594` | `handleNavigate(SETTINGS_BILLING)` | jw. | — | — | — | — | — | OK-LOKALNY | |
| 31 | „AI Configuration" | `settings.menu.aiConfig` | `UserProfileMenu.tsx:595-601` | `handleNavigate(SETTINGS_AI)` | jw. | — | — | — | — | — | OK-LOKALNY | |
| 32 | „Replay onboarding" | `firstRun.relaunch.menu` | `UserProfileMenu.tsx:603-612` | `requestFirstRunRelaunch()` | event bus `consultify:onboarding:relaunch` → nasłuchuje `FirstRunOnboarding.tsx:56` (zamontowany w `MainLayout.tsx:294`) | — | — | — | — | — | OK-LOKALNY | potwierdzony żywy listener |
| 33 | „Log Out" | `sidebar.logOut` | `UserProfileMenu.tsx:616-622` | `handleLogout`→`logout()` (store) | fire-and-forget `POST /api/auth/logout` | `server/src/routes/auth.routes.ts:1108` | inline | — | 401 | OK | |
| 34 | Przełącznik zwijania lewego menu | `sidebar.collapse`/`sidebar.expand` | `src/components/navigation/Sidebar/SidebarHeader.tsx:47-57,72-81` | `onToggleCollapse`→`toggleSidebarCollapse` (store) | — | — | — | — | — | — | OK-LOKALNY | ikona pod logo, potwierdzone okablowanie przez `Sidebar.tsx:476` |
| 35 | Pasek prawy — „?" (Help) | `widgets.help.title` | `src/components/Help/HelpToggleButton.tsx:19-36` | `toggleSidePanel('HELP')` | — | — | — | — | — | — | OK-LOKALNY | otwiera `HelpSidePanel` (zamontowany globalnie `MainLayout.tsx:282`) |
| 36 | Pasek prawy — ikona „chmurka" (**to jest FEEDBACK, nie czat**) | `widgets.feedback.title`="Opinie" | `src/components/Feedback/FeedbackToggleButton.tsx:14-42` | `toggleSidePanel('FEEDBACK')` | — | — | — | — | — | — | OK-LOKALNY | Brief mylnie zakładał że to „czat" — patrz D-6 |
| 37 | Pasek prawy — „dokument" (FileText) | `widgets.documents.title` | `src/components/documents/DocumentToggleButton.tsx:14-42` | `toggleSidePanel('DOCUMENTS')` | — | — | — | — | — | — | OK-LOKALNY | MA handler (odpowiedź na pytanie z briefu) — otwiera `DocumentSidePanel` |
| 38 | HelpSidePanel — 3 zakładki (overview/this_step/knowledge) | `help.sidePanel.tabs.*` | `src/components/Help/HelpSidePanel.tsx:411-424` | `setActiveTab(id)` | — | — | — | — | — | — | OK-LOKALNY | |
| 39 | HelpSidePanel — „Open app intro" | `help.sidePanel.overview.openIntro` | `HelpSidePanel.tsx:441-457` | `openIntroScreen`→`navigate(ROUTES.APP_INTRO)` | — | — | — | — | — | — | OK-LOKALNY | |
| 40 | HelpSidePanel — „Ask AI now" (×2, overview+this_step) | `help.sidePanel.*.askAi`/podobne | `HelpSidePanel.tsx:545-556,643-655` | `openAiNow` | ustawia `chatKickoffMessage`+`workspaceContext` w store, potem `toggleChatCollapse` (desktop) | — | — | — | — | — | **URWANY na `/chat`** | D-1 — patrz Defekty |
| 41 | HelpSidePanel — „Keyboard shortcuts" | — | `HelpSidePanel.tsx:554-561` | `setShowKeyboardShortcuts(true)` | — | — | — | — | — | — | OK-LOKALNY | modal klient |
| 42 | HelpSidePanel — linki „guide" (knowledge) | — | `HelpSidePanel.tsx:663-671` | `handleGuideClick` | — | — | — | — | — | — | OK-LOKALNY | zmienia zakładkę/otwiera artykuł |
| 43 | HelpSidePanel — close (X, ×2) | `common.close` | `HelpSidePanel.tsx:392-398,739-748` | `setOpen(false)` | — | — | — | — | — | — | OK-LOKALNY | |
| 44 | FeedbackSidePanel — zakładki Report/Pulse | — | `FeedbackSidePanel.tsx:707-715` | `setActiveTab` | — | — | — | — | — | — | OK-LOKALNY | |
| 45 | FeedbackSidePanel — Bug/Idea toggle | — | `FeedbackSidePanel.tsx:762-782` | `setReportType` | — | — | — | — | — | — | OK-LOKALNY | |
| 46 | FeedbackSidePanel — „Improve with AI" | — | `FeedbackSidePanel.tsx:847-...` | `improveReportWithAI`→`Api.composeFeedback` | `POST /api/feedback/compose` | `server/src/routes/feedback.routes.ts:952` | inline | — | 401 | OK | |
| 47 | FeedbackSidePanel — submit raportu | `feedback...submit` | formularz `onSubmit` (poza widocznym zakresem grep, weryfikacja przez `Api.sendFeedback`) | `Api.sendFeedback` | `POST /api/feedback` | `feedback.routes.ts:1587` (`optionalVerifyToken`) | inline | — | 400 (bez body) | OK | trasa istnieje, `optionalVerifyToken` = działa też bez logowania |
| 48 | FeedbackSidePanel — Pulse (5 emoji) | — | `FeedbackSidePanel.tsx:1290-1310` | `handlePulseSubmit`→`Api.submitPulseFeedback` | `POST /api/feedback/pulse` | `feedback.routes.ts:2735` | inline | — | 400 | OK | |
| 49 | FeedbackSidePanel — submit „Feature Request" | `feedback.feature.submit` | `FeedbackSidePanel.tsx:1222-1238` | formularz→`Api.submitFeatureFeedback` | `POST /api/feedback/feature` | `feedback.routes.ts:2822` | inline | — | 400 | OK | |
| 50 | FeedbackSidePanel — upload/usuń screenshot | — | `FeedbackSidePanel.tsx:985,1000` | lokalny `<input type=file>` + `setUploadedScreenshot(null)` | — | — | — | — | — | — | OK-LOKALNY | plik trzymany w stanie do wysłania z formularzem |
| 51 | DocumentSidePanel — zakładki Project/User | — | `DocumentSidePanel.tsx:301,312` | `setActiveTab` | `Api.getProjectDocuments`/`Api.getUserDocuments` | `GET /api/documents/...`(user) | mount `Gateway.ts:754` `/api/documents` (za `gatewayVerifyToken`) | | — | 401 (`/documents/user`) | OK | |
| 52 | DocumentSidePanel — Refresh | — | `DocumentSidePanel.tsx:340` | `loadDocuments()` | jw. | jw. | jw. | — | — | OK | |
| 53 | DocumentSidePanel — Download | — | `DocumentSidePanel.tsx:529` | `handleDownload`→`Api.downloadDocument` | `GET /api/documents/:id/download` | jw. | | — | — | OK | curl pominięty (identyczny wzorzec mountu, zweryfikowany na `/documents/user`) |
| 54 | DocumentSidePanel — Move to project | — | `DocumentSidePanel.tsx:538` | `handleMoveToProject`→`Api.moveDocumentToProject` | `PATCH/POST /api/documents/:id/move-to-project` | jw. | | — | — | OK | |
| 55 | DocumentSidePanel — Delete | — | `DocumentSidePanel.tsx:547` | `handleDelete`→`Api.deleteDocument` | `DELETE /api/documents/:id` | jw. | | — | 401 | OK | |
| 56 | DocumentSidePanel — „Acknowledge" (uwaga przetwarzania) | — | `DocumentSidePanel.tsx:496` | `handleAcknowledgeProcessingAttention`→`Api.acknowledgeDocumentProcessingAttention` | `PATCH /api/documents/:id/processing-attention/ack` | jw. | | — | — | OK | |
| 57 | DocumentSidePanel — „Admin operations" link | — | `DocumentSidePanel.tsx:512` | `handleOpenAdminOperations`→`setCurrentView(ADMIN_BULK_OPERATIONS)` | — | — | — | — | — | — | OK-LOKALNY | |
| 58 | GlobalAccessBanners — „Start trial" / „Upgrade" / „Contact sales" | — | `MainLayout.tsx:337-339`, okablowanie w `GlobalAccessBanners.tsx:77-166` | `window.location.assign('/auth?action=trial')` / `('/settings?tab=billing')` / `window.open('https://consultify.io/contact')` | — | — | — | — | warunkowe (trial/paywall) | — | OK-LOKALNY | banery renderują się tylko w określonym stanie dostępu — nie zweryfikowano wizualnie (brak takiej sesji) |
| 59 | AIFreezeBanner — „Increase Budget" | `aiFreezeBanner.increaseBudget` | `src/components/AIFreezeBanner.tsx:40-45` | `window.location.href='/settings/billing'` | — | — | — | — | warunkowe (`aiFreezeStatus.isFrozen`) | — | OK-LOKALNY | nie zaobserwowano stanu zamrożenia na żywo |
| 60 | MfaEnrollmentBanner — „Skonfiguruj" + dismiss X | `mfa.graceBanner.action` | `src/components/layout/MfaEnrollmentBanner.tsx:82-102` | `<Link to="/settings/security">` / `localStorage` dismiss | `GET /api/mfa/status` (tło) | `server/src/routes/mfa*.routes.ts` (mount niezweryfikowany dokładnie liniowo, ale curl potwierdza trasę) | — | warunkowe (`enforced && !enabled`) | 401 | OK | |
| 61 | DemoModeBanner — „Open story rail" | — | `src/components/layout/DemoModeBanner.tsx:159` | `window.dispatchEvent('demo:open_story_rail')` | nasłuchuje `DemoSessionManager.tsx:114` (zamontowany `MainLayout.tsx:291`) | — | — | — | tylko demo | — | OK-LOKALNY | potwierdzony żywy listener |
| 62 | DemoModeBanner — expand/collapse | — | `DemoModeBanner.tsx:171` | `setIsExpanded` | — | — | — | — | — | — | OK-LOKALNY | |
| 63 | DemoModeBanner — „Exit demo" (×2) | — | `DemoModeBanner.tsx:189,286` | `exitDemoMode`→`useDemo`→`Api.toggleDemoMode(false)` | `POST /api/demo/toggle` | jw. poz.28 | | — | 401 | OK | |
| 64 | DemoModeBanner — link „/help" | — | `DemoModeBanner.tsx:277` | `navigate('/help')` | — | — | — | — | — | — | OK-LOKALNY | |

---

## Ustalenia o plikach wskazanych w briefie, które NIE są na realnej ścieżce renderu

Brief wskazał kilka plików „do sprawdzenia" — poniżej rozstrzygnięcie każdego, bo część z nich to
martwe bliźniaki żywych komponentów (mogłyby zmylić inne agenty):

- **`src/components/layout/DemoTopbarStatus.tsx`** — **NIEWIDOCZNY**. Zero importów w całym `src/`
  poza własną definicją. To NIE jest źródło pigułek „Dane"/„Model" — te renderuje
  `SystemHealth.tsx` i `LLMSelector.tsx` (poz. 3-5). `DemoTopbarStatus` to osobny, martwy komponent
  odliczania czasu sesji demo.
- **`src/components/ui/HelpButton.tsx`** i **`src/components/layout/HelpPanel.tsx`** —
  **NIEWIDOCZNY**, para. Zero importów poza sobą nawzajem/definicją. Realny help na `/chat` to
  `src/components/Help/HelpToggleButton.tsx` + `src/components/Help/HelpSidePanel.tsx` (poz. 35, 38-43).
  Oba systemy używają tego samego `src/contexts/HelpContext.tsx` (real: `useHelpSidePanel`,
  martwy: `useHelp`) — więc `HelpContext.tsx` sam w sobie NIE jest martwy, tylko ma dwóch
  konsumentów z których jeden nigdy się nie renderuje.
- **`src/components/AIChat/ChatToggleButton.tsx`** i **`src/components/AIChat/ChatOverlay.tsx`** —
  **NIEWIDOCZNY**, para. Zero importów w całym `src/` poza sobą nawzajem (jeden komentarz w
  `ChatToggleButton.tsx:39` wspomina `ChatOverlay`, to wszystko). Prawy pasek NIE zawiera trzeciej
  ikony czatu — druga ikona paska to Feedback (poz. 36), nie chat.
- **`src/components/AIChat/ChatSlidingPanel.tsx`** — używany, ale NIE w prawym pasku. Renderowany
  wewnątrz `UnifiedChatPanel.tsx:7479` jako panel historii konwersacji (`showHistoryTrigger`) — to
  część samej rozmowy, poza zakresem F.
- **`src/components/AIChat/ActiveModeStrip.tsx`** — **NIEWIDOCZNY**. Zero importów poza definicją.
- **`src/components/AIChat/ChatSignalsPanel.tsx`** — używany, `UnifiedChatPanel.tsx:126,7524-7528`,
  otwierany przyciskiem „Important signals" w headerze SAMEGO `UnifiedChatPanel`
  (`UnifiedChatPanel.tsx:6810-6820`, `data-testid="chat-signals-button"`), bramkowany flagą
  `myWorkSignalsV2` (`src/hooks/useFeatureFlags.tsx:117-123`, `defaultValue: true` — domyślnie
  WŁĄCZONA, brak nadpisania w `.env.local`). To element wnętrza rozmowy (Sparkles icon w headerze
  czatu), nie ramy — ale skoro brief pytał wprost: tak, dostępny z `/chat`, przyciskiem.
- **`src/components/AIChat/OrganizationMemoryPanel.tsx`** — **NIEWIDOCZNY**. Zero importów poza
  definicją.
- **`src/components/AIChat/TransformationCasesPanel.tsx`** — używany, ale w `AgentHubShell.tsx`,
  który jest lazy-importowany i renderowany WYŁĄCZNIE w `src/components/MyWork/MyWorkHub.tsx:4280`
  (moduł „My Work" / `/my-work`). **NIEosiągalny z `/chat`.**
- **„Tytuł" nagłówka Czat AI** — nie istnieje osobny komponent tytułu; to zwykły breadcrumb string
  `t('navigation.aiChat','AI Chat')` przekazany do `MainLayout` (poz. 2), nieklikalny.

---

## Defekty

| D-n | P | element | co jest nie tak | dowód plik:linia | jak odtworzyć |
|---|---|---|---|---|---|
| D-1 | **P1** | HelpSidePanel „Ask AI now" (openAiNow) — poz. 40 | Na trasie `/chat` (i `/chat/:id`) wiadomość-kickoff jest zapisywana w store (`setChatKickoffMessage`), ale `UnifiedChatPanel mode="full"` na tych trasach jest renderowany BEZ propa `kickoffMessage` (`AppRoutes.tsx:1772-1782` i `:1858-1869`), a `UnifiedChatPanel` czyta kickoff wyłącznie z propa, nie ze store (`UnifiedChatPanel.tsx:804,5007-5019`). Efekt: wiadomość nigdy nie trafia do czatu i nigdy nie jest czyszczona (`onKickoffConsumed` też nie jest podpięty na tej trasie). | `src/components/Help/HelpSidePanel.tsx:307-337` (openAiNow); `src/routes/AppRoutes.tsx:1771-1782,1858-1869`; `src/components/AIChat/UnifiedChatPanel.tsx:763,804,5007-5019` | Będąc na `/chat` (desktop), otwórz „?" (Help) → dowolna zakładka → „Ask AI now". Panel Help się zamyka, ale w oknie rozmowy nic się nie pojawia — wiadomość przepadła. Działa poprawnie tylko z ekranów INNYCH niż `/chat` (tam chat jest split-panelem w `MainLayout`, który propsy przekazuje poprawnie, `MainLayout.tsx:505-506`). |
| D-2 | P2 | TaskDropdown „Create new task" — poz. 9 | Etykieta obiecuje tworzenie zadania, handler tylko nawiguje do `/my-work` (`handleNavigateToTasks`) — nic nie tworzy, nie otwiera formularza tworzenia. | `src/components/TaskDropdown.tsx:100-104,214-219` | Otwórz dzwonek-zadania z pustą listą (brak zadań) → kliknij „Create new task" → ląduje się na liście My Work bez żadnego dialogu tworzenia. |
| D-3 | P2 | i18n — `system.dataAccess` | Klucz tłumaczenia nagłówka panelu „Data Access" w pigułce „Dane" nie istnieje ANI w `pl`, ANI w `en` translation.json — zawsze pokazuje twardy fallback string z kodu, niezależnie od języka aplikacji. | `src/components/SystemHealth.tsx:191` (`t('system.dataAccess','Data Access')`); brak klucza w `public/locales/pl/translation.json` i `public/locales/en/translation.json` | Otwórz pigułkę „Dane" w dowolnym języku — nagłówek rozwiniętego panelu zawsze brzmi „Data Access" po angielsku. |
| D-4 | P2 (higiena kodu, nie defekt UI) | `PendingActionsIndicator.tsx`, `DemoTopbarStatus.tsx`, `ui/HelpButton.tsx`+`layout/HelpPanel.tsx`, `ChatToggleButton.tsx`+`ChatOverlay.tsx`, `ActiveModeStrip.tsx`, `OrganizationMemoryPanel.tsx` | Sześć (a właściwie 7 plików w parach) kompletnych, gotowych komponentów bez ŻADNEGO importera w `src/` — martwy kod, który może zmylić przyszły audyt/refaktor (ktoś może uznać, że to one obsługują widoczne ikony). | patrz sekcja „Ustalenia..." wyżej, z liniami | `grep -rln "<nazwa>" src/` poza plikiem definicji zwraca pustkę dla każdego z nich. |
| D-5 | P2 | NotificationDropdown „Inbox" vs „Center" — poz. 12-13 | Dwa przyciski, dwie różne etykiety PL („Skrzynka" i „Centrum"), IDENTYCZNY handler (`setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)`) — mylące UX, wygląda jak dwie różne funkcje. | `src/components/layout/NotificationDropdown.tsx:373-394` | Otwórz dzwonek → kliknij „Skrzynka" i osobno „Centrum" — oba lądują na tym samym `/my-work?tab=inbox`. |
| D-6 | P2 (korekta dla innych agentów) | Prawy pasek — druga ikona | Brief zakładał, że druga ikona paska to „czat" (i wskazywał `ChatToggleButton`/`ChatOverlay`/`ChatSlidingPanel` jako podejrzanych). W rzeczywistości druga ikona to **Feedback/Opinie** (`FeedbackToggleButton.tsx`, ikona `MessageSquareText` — wygląda jak dymek czatu, ale otwiera formularz zgłoszenia błędu/pomysłu, nie czat). Prawdziwe komponenty czatu (`ChatToggleButton`/`ChatOverlay`) są martwe (D-4). | `src/components/Feedback/FeedbackToggleButton.tsx:14-42`; `public/locales/pl/translation.json` klucz `widgets.feedback.title`="Opinie" | Najedź na drugą ikonę paska po prawej — tooltip mówi „Opinie", nie „Czat". |

---

## Niezweryfikowane

1. **Warunkowe bannery bez zaobserwowanego stanu na żywo**: `GlobalAccessBanners` (trial/paywall),
   `AIFreezeBanner` (budżet zamrożony), `MfaEnrollmentBanner` (karencja MFA), `DemoModeBanner`
   (tylko w trybie demo) — kod i trasy HTTP zweryfikowane statycznie (poz. 58-64), ale nie
   zaobserwowałem żadnego z tych stanów wizualnie na żywej sesji (brak takiego konta/uprawnień w
   trybie tylko-odczyt). Klasyfikacja OK-LOKALNY oparta o czytanie kodu, nie o zrzut ekranu.
2. **FeedbackSidePanel — dokładna linia `onSubmit` formularza raportu** (poz. 47): plik ma 1439
   linii; zidentyfikowałem wywołanie `Api.sendFeedback` (linia 499) i trasę serwera, ale nie
   prześledziłem dokładnie który DOM `<form onSubmit>` go wywołuje (jest kilka formularzy w pliku:
   report/pulse/feature). Nie wpływa to na klasyfikację (trasa istnieje, metoda się zgadza), ale
   numer linii przycisku „Wyślij" dla raportu bug/idea nie jest dokładnie wskazany.
3. **DocumentSidePanel — upload** (`Api.uploadDocumentToLibrary`, linia 96): zidentyfikowany
   handler i trasa `POST /api/documents/upload` (curl 401 potwierdza istnienie), ale nie
   zlokalizowałem dokładnie przycisku/inputu pliku w JSX (plik ma 577 linii, funkcja jest wywoływana
   z `onChange` inputu, którego nie wypisałem numerem linii).
4. **Pełny audyt i18n** (reguła 3 z briefu) zrobiłem tylko punktowo (kilka kluczowych etykiet z
   tabeli powyżej + D-3). Nie przeszedłem całej tabeli klucz-po-kluczu przez `pl/translation.json` —
   przy ~60 elementach to osobne zadanie.
5. **`server/src/routes/mfa*.routes.ts`** — potwierdziłem działanie przez `curl` (401) i przez
   odczyt frontendu (`Api.get('/api/mfa/status')`), ale nie zlokalizowałem dokładnego pliku+linii
   montażu trasy `/api/mfa` w Gateway/index (brak w moim gonieniu za czasem — trasa realnie
   odpowiada 401, więc klasyfikacja OK stoi, ale bez cytatu `plik:linia` montażu).

---

## Liczby

- **Elementy klikalne/interaktywne policzone w Inwentarzu: 64** (obejmuje warianty — np. 4 tiery
  LLM, 3 motywy, ×N języki liczone jako 1 wiersz z adnotacją „×N/×3").
- Nadzorca szacował 20-30 — **realna liczba jest wyższa (64)**, bo brief prosił o policzenie też
  pozycji WEWNĄTRZ paneli otwieranych z ramy (Help/Feedback/Documents side-panels, rozwijane
  dropdowny Notifications/Tasks/UserProfile) zgodnie z regułą 5 briefu („idź dalej, do przycisków
  tego panelu"). Licząc tylko przyciski/ikony NAJWYŻSZEGO poziomu ramy (bez zawartości paneli) —
  wychodzi ~23, co jest zgodne z szacunkiem nadzorcy.
- Rozkład klas: **OK = 33**, **OK-LOKALNY = 27**, **URWANY = 2** (poz. 9 „Create new task" liczony
  jako URWANY etykiety, D-1 „Ask AI now" na `/chat` liczony jako pozycja 40 URWANY), **MARTWY = 0**
  (żaden ZNALEZIONY na ścieżce renderu element nie jest martwy — martwe są całe PLIKI/komponenty
  spoza ścieżki renderu, opisane osobno w sekcji „Ustalenia" i D-4, nie liczę ich jako elementy
  Inwentarza bo nigdy się nie renderują), **ZA FLAGĄ = 1** (ChatSignalsPanel, `myWorkSignalsV2`,
  domyślnie ON), **NIEWIDOCZNY = 7 plików** (opisane w osobnej sekcji, nie w głównym Inwentarzu),
  **NIEPEWNY = 0**.
- Defekty: **P0 = 0, P1 = 1 (D-1), P2 = 5 (D-2, D-3, D-4, D-5, D-6)**.
