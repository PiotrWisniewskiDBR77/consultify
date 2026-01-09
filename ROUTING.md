# Routing Guide

## Overview

Consultinity uses **React Router v7** for client-side routing. This guide explains the routing structure, how to navigate, and how to add new routes.

## Route Structure

### Public Routes
- `/auth` - Authentication (login/register)
- `/invite/:token` - Invitation acceptance
- `/report/:id` - Public report view

### Protected Routes

#### Main Application
- `/` or `/dashboard` - Main dashboard
- `/studio` - AI Studio
- `/my-work` - User workspace and tasks

#### Context Builder (Nested)
- `/context` - Organization profile (default)
- `/context/profile` - Organization profile
- `/context/goals` - Strategic goals
- `/context/challenges` - Business challenges
- `/context/megatrends` - Megatrends analysis
- `/context/strategy` - Strategy definition

#### Assessment (Nested)
- `/assessment` - Assessment hub dashboard
- `/assessment/drd` - DRD Framework assessment
- `/assessment/siri` - SIRI Framework assessment
- `/assessment/adma` - ADMA Framework assessment
- `/assessment/cmmi` - CMMI Framework assessment
- `/assessment/lean` - LEAN Framework assessment
- `/assessment/overview` - Assessment overview
- `/assessment/summary` - Assessment summary

#### Transformation Modules
- `/initiatives` - Initiative management
- `/roadmap` - Transformation roadmap
- `/portfolio` - Portfolio view
- `/roi` - ROI analysis
- `/economics` - Economic analysis
- `/execution` - Execution tracking
- `/implementation` - Implementation planning
- `/rollout` - Rollout management
- `/reports` - Executive reports
- `/kpi-okr` - KPIs and OKRs
- `/benefits` - Benefits realization

#### Settings (Nested)
- `/settings` - User settings
- `/settings/profile` - Profile settings
- `/settings/billing` - Billing settings
- `/settings/ai` - AI preferences
- `/settings/notifications` - Notification preferences
- `/settings/integrations` - Integration settings
- `/settings/organization` - Organization settings
- `/settings/security` - Security settings

#### Admin (Nested - ADMIN role required)
- `/admin` - Admin dashboard
- `/admin/overview` - Admin overview
- `/admin/organization` - Organization management
- `/admin/team` - Team management
- `/admin/workspace` - Workspace configuration
- `/admin/ai` - AI configuration
- `/admin/billing` - Billing management
- `/admin/security` - Security settings

## Navigation

### Using the useAppNavigation Hook

The recommended way to navigate is using the `useAppNavigation` hook:

```typescript
import { useAppNavigation } from '@/hooks/useAppNavigation';

function MyComponent() {
  const { navigateTo } = useAppNavigation();

  const handleClick = () => {
    navigateTo('/studio');
  };

  return <button onClick={handleClick}>Go to Studio</button>;
}
```

### Using React Router's Link Component

For declarative navigation:

```typescript
import { Link } from 'react-router-dom';

function MyComponent() {
  return <Link to="/studio">Go to Studio</Link>;
}
```

### Programmatic Navigation

Using React Router's `useNavigate` hook:

```typescript
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/studio');
  };

  return <button onClick={handleClick}>Go to Studio</button>;
}
```

## Adding a New Route

### 1. Add Route Constant

In `src/routes/routeConfig.ts`:

```typescript
export const ROUTES = {
  // ... existing routes
  MY_NEW_ROUTE: '/my-new-route',
} as const;
```

### 2. Create the View Component

Create your view component (e.g., `src/views/MyNewView.tsx`):

```typescript
export const MyNewView: React.FC = () => {
  return (
    <div>
      <h1>My New View</h1>
    </div>
  );
};
```

### 3. Add Lazy Import

In `src/routes/AppRoutes.tsx`, add lazy import:

```typescript
const MyNewView = React.lazy(() => 
  import('@/views/MyNewView').then((m) => ({ default: m.MyNewView }))
);
```

### 4. Add Route Definition

In `src/routes/AppRoutes.tsx`, add the route:

```typescript
<Route 
  path={ROUTES.MY_NEW_ROUTE} 
  element={
    <AnimationWrapper variant="slideUp">
      <MyNewView />
    </AnimationWrapper>
  } 
/>
```

### 5. Add SEO Meta (Optional)

In `src/hooks/usePageMeta.ts`, add meta tags:

```typescript
const PAGE_META: Record<string, { title: string; description: string }> = {
  // ... existing meta
  [ROUTES.MY_NEW_ROUTE]: {
    title: 'My New Route | Consultinity',
    description: 'Description of my new route',
  },
};
```

## Protected Routes

To protect a route with authentication/authorization:

```typescript
import { ProtectedRoute } from '@/components/ProtectedRoute';

<Route 
  path={ROUTES.ADMIN.ROOT} 
  element={
    <ProtectedRoute requiredRole="ADMIN">
      <AdminView />
    </ProtectedRoute>
  } 
/>
```

## Error Handling

All routes are wrapped in `RouteErrorBoundary` for graceful error handling:

```typescript
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

<RouteErrorBoundary>
  <MyView />
</RouteErrorBoundary>
```

## Code Splitting & Lazy Loading

All routes use React.lazy() for automatic code splitting:

```typescript
const MyView = React.lazy(() => import('@/views/MyView'));
```

This creates separate bundles for each route, improving initial load time.

## Analytics & SEO

### Page Tracking

Page views are automatically tracked using `usePageTracking()` hook in App.tsx.

### Meta Tags

SEO meta tags are automatically updated using `usePageMeta()` hook.

## Best Practices

1. **Always use route constants** from `routeConfig.ts` instead of hardcoded strings
2. **Use lazy loading** for all route components
3. **Wrap protected routes** in `ProtectedRoute` component
4. **Add error boundaries** for critical routes
5. **Update SEO meta** for all new routes
6. **Test navigation** thoroughly after adding new routes

## Troubleshooting

### Route not working
- Check if route is defined in `routeConfig.ts`
- Verify route is added to `AppRoutes.tsx`
- Check for typos in route path
- Ensure component is properly lazy-loaded

### 404 on refresh
- This is expected in development
- In production, configure server to serve index.html for all routes

### Lazy loading errors
- Check import path is correct
- Verify component is exported correctly
- Check browser console for detailed error

## Migration from ViewRenderer

The old `ViewRenderer.tsx` has been removed. All navigation now uses React Router.

**Old way (deprecated):**
```typescript
setCurrentView(AppView.STUDIO);
```

**New way:**
```typescript
navigateTo('/studio');
// or
navigate('/studio');
```

## Resources

- [React Router Documentation](https://reactrouter.com/)
- [Code Splitting](https://react.dev/reference/react/lazy)
- [Route Configuration](./src/routes/routeConfig.ts)
- [App Routes](./src/routes/AppRoutes.tsx)
