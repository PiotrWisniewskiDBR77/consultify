import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

/**
 * L2 (Component/UI) coverage config.
 *
 * Scope is intentionally narrow: auth login + MFA components.
 * This makes 95% coverage meaningful and achievable without pulling in the whole frontend.
 */
const base = baseConfig as any;

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    environment: 'jsdom',
    include: [
      'tests/components/auth/**/*.{test,spec}.{ts,tsx}',
      'tests/components/navigation/**/*.{test,spec}.{ts,tsx}',
      'tests/components/organization/**/*.{test,spec}.{ts,tsx}',
      'tests/components/AIChat/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    coverage: {
      ...(base.test?.coverage || {}),
      reportsDirectory: 'test-results/coverage/l2',
      include: [
        'views/auth/LoginView.tsx',
        'src/components/auth/MFASetup.tsx',
        'src/components/auth/MFAChallenge.tsx',
        'src/components/navigation/Sidebar/menuConfig.ts',
        'src/components/navigation/Sidebar/Sidebar.tsx',
        'src/components/navigation/Sidebar/NavItem.tsx',
        'src/components/navigation/Sidebar/SidebarFooter.tsx',
        'src/components/navigation/Sidebar/SidebarHeader.tsx',
        'src/components/navigation/Sidebar/FloatingSubmenu.tsx',
        'src/views/OrganizationView.tsx',
        'src/components/Organization/OrganizationSidebar.tsx',
        'src/components/AIChat/UnifiedChatPanel.tsx',
        'src/components/AIChat/CoThinkerModeSelector.tsx',
        'src/components/AIChat/ToolsMenu.tsx',
        'src/components/AIChat/ConversationList.tsx',
      ],
      thresholds: {
        global: {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95,
        },
        perFile: {
          'views/auth/LoginView.tsx': { statements: 95, branches: 80, functions: 95, lines: 95 },
          'src/components/auth/MFASetup.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/auth/MFAChallenge.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/menuConfig.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/Sidebar.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/NavItem.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/SidebarFooter.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/SidebarHeader.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/navigation/Sidebar/FloatingSubmenu.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/views/OrganizationView.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/Organization/OrganizationSidebar.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/AIChat/UnifiedChatPanel.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/AIChat/CoThinkerModeSelector.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/AIChat/ToolsMenu.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'src/components/AIChat/ConversationList.tsx': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
        },
      },
    },
  },
});
