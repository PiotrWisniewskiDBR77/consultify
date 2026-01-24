#!/usr/bin/env node
/**
 * Navigation Validation CI Script
 *
 * Run this script to validate navigation configuration:
 * - All AppView enum values have route mappings
 * - All menu items have valid viewIds
 * - No orphaned routes
 *
 * Usage:
 *   node scripts/validate-navigation.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failures found
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating navigation configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Read and parse the source files
const routeConfigPath = path.join(__dirname, '../src/routes/routeConfig.ts');
const menuConfigPath = path.join(__dirname, '../src/components/navigation/Sidebar/menuConfig.ts');
const coreTypesPath = path.join(__dirname, '../src/types/core.ts');

// Helper to extract enum values
function extractAppViewValues(content) {
  const enumMatch = content.match(/export enum AppView \{([^}]+)\}/s);
  if (!enumMatch) return [];

  const enumContent = enumMatch[1];
  const values = [];
  const lines = enumContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*(\w+)\s*=/);
    if (match) {
      values.push(match[1]);
    }
  }

  return values;
}

// Helper to extract route mappings
function extractRouteMappings(content) {
  const mappings = [];
  const regex = /\[AppView\.(\w+)\]:\s*([^,\n]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    mappings.push({
      view: match[1],
      route: match[2].trim(),
    });
  }

  return mappings;
}

// Helper to extract menu viewIds
function extractMenuViewIds(content) {
  const viewIds = [];
  const regex = /viewId:\s*AppView\.(\w+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    viewIds.push(match[1]);
  }

  return viewIds;
}

try {
  // Read files
  const routeConfigContent = fs.readFileSync(routeConfigPath, 'utf-8');
  const menuConfigContent = fs.readFileSync(menuConfigPath, 'utf-8');
  const coreTypesContent = fs.readFileSync(coreTypesPath, 'utf-8');

  // Extract data
  const appViewValues = extractAppViewValues(coreTypesContent);
  const routeMappings = extractRouteMappings(routeConfigContent);
  const menuViewIds = extractMenuViewIds(menuConfigContent);

  console.log(`📊 Found ${appViewValues.length} AppView enum values`);
  console.log(`📊 Found ${routeMappings.length} route mappings`);
  console.log(`📊 Found ${menuViewIds.length} menu viewIds\n`);

  // Check 1: All AppView values have route mappings
  console.log('Check 1: Route mapping completeness');
  const mappedViews = new Set(routeMappings.map((m) => m.view));
  const unmappedViews = appViewValues.filter((v) => !mappedViews.has(v));

  if (unmappedViews.length > 0) {
    console.log(`  ❌ ${unmappedViews.length} AppView values missing route mappings:`);
    unmappedViews.forEach((v) => console.log(`     - AppView.${v}`));
    hasErrors = true;
  } else {
    console.log('  ✅ All AppView values have route mappings');
  }

  // Check 2: All menu viewIds are valid AppView values
  console.log('\nCheck 2: Menu viewId validity');
  const appViewSet = new Set(appViewValues);
  const invalidMenuViews = menuViewIds.filter((v) => !appViewSet.has(v));

  if (invalidMenuViews.length > 0) {
    console.log(`  ❌ ${invalidMenuViews.length} invalid menu viewIds:`);
    invalidMenuViews.forEach((v) => console.log(`     - ${v}`));
    hasErrors = true;
  } else {
    console.log('  ✅ All menu viewIds are valid');
  }

  // Check 3: All menu viewIds have route mappings
  console.log('\nCheck 3: Menu viewId route mappings');
  const menuViewsWithoutRoutes = menuViewIds.filter((v) => !mappedViews.has(v));

  if (menuViewsWithoutRoutes.length > 0) {
    console.log(`  ❌ ${menuViewsWithoutRoutes.length} menu viewIds without route mappings:`);
    menuViewsWithoutRoutes.forEach((v) => console.log(`     - AppView.${v}`));
    hasErrors = true;
  } else {
    console.log('  ✅ All menu viewIds have route mappings');
  }

  // Check 4: Duplicate route detection (warning only)
  console.log('\nCheck 4: Duplicate route detection');
  const routeToViews = {};
  routeMappings.forEach(({ view, route }) => {
    if (!routeToViews[route]) {
      routeToViews[route] = [];
    }
    routeToViews[route].push(view);
  });

  const duplicateRoutes = Object.entries(routeToViews).filter(([_, views]) => views.length > 1);
  if (duplicateRoutes.length > 0) {
    console.log(
      `  ⚠️  ${duplicateRoutes.length} routes shared by multiple views (may be intentional):`
    );
    duplicateRoutes.slice(0, 10).forEach(([route, views]) => {
      console.log(`     ${route}: ${views.join(', ')}`);
    });
    if (duplicateRoutes.length > 10) {
      console.log(`     ... and ${duplicateRoutes.length - 10} more`);
    }
    hasWarnings = true;
  } else {
    console.log('  ✅ No duplicate routes found');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED - Please fix the errors above');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
    process.exit(0);
  } else {
    console.log('✅ ALL VALIDATIONS PASSED');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ Error running validation:', error.message);
  process.exit(1);
}
