#!/usr/bin/env node
/**
 * Test Generator Script
 * 
 * Generuje szkielet testu na podstawie szablonów.
 * 
 * Użycie:
 *   node scripts/generate-test.cjs <type> <name> [path]
 * 
 * Przykłady:
 *   node scripts/generate-test.cjs component FocusBoard components/MyWork/Focus
 *   node scripts/generate-test.cjs middleware rbac server/middleware
 *   node scripts/generate-test.cjs route my-work server/routes
 *   node scripts/generate-test.cjs e2e myWork tests/e2e
 *   node scripts/generate-test.cjs hook useFocus hooks
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../tests/templates');
const TESTS_DIR = path.join(__dirname, '../tests');

const TEMPLATE_MAP = {
  component: 'component.test.template.tsx',
  middleware: 'middleware.test.template.js',
  route: 'route.integration.test.template.js',
  e2e: 'e2e.test.template.ts',
  hook: 'hook.test.template.ts',
};

const OUTPUT_DIR_MAP = {
  component: 'components',
  middleware: 'unit/backend/middleware',
  route: 'integration/routes',
  e2e: 'e2e',
  hook: 'hooks',
};

const FILE_EXT_MAP = {
  component: '.test.tsx',
  middleware: '.test.js',
  route: '.test.js',
  e2e: '.spec.ts',
  hook: '.test.ts',
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(capitalize)
    .join('');
}

function generateTest(type, name, sourcePath) {
  const templateFile = TEMPLATE_MAP[type];
  if (!templateFile) {
    console.error(`❌ Unknown test type: ${type}`);
    console.log(`Available types: ${Object.keys(TEMPLATE_MAP).join(', ')}`);
    process.exit(1);
  }

  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${templatePath}`);
    process.exit(1);
  }

  // Read template
  let template = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  const pascalName = toPascalCase(name);
  const replacements = {
    'ComponentName': pascalName,
    'middlewareName': name,
    'useCustomHook': `use${pascalName}`,
    'custom-hook': name,
    '/api/resource': `/api/${name.toLowerCase()}`,
    'Resource Management': `${pascalName} Management`,
  };

  for (const [from, to] of Object.entries(replacements)) {
    template = template.replace(new RegExp(from, 'g'), to);
  }

  // Remove template header comment
  template = template.replace(/\/\*\*\n \* TEMPLATE:[\s\S]*?\*\/\n\n/, '');

  // Determine output path
  let outputDir;
  if (sourcePath) {
    // Custom path provided
    outputDir = path.join(TESTS_DIR, OUTPUT_DIR_MAP[type], sourcePath.replace(/^(components|server)\//, ''));
  } else {
    outputDir = path.join(TESTS_DIR, OUTPUT_DIR_MAP[type]);
  }

  // Create directory if needed
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, `${name}${FILE_EXT_MAP[type]}`);

  // Check if file already exists
  if (fs.existsSync(outputFile)) {
    console.error(`❌ Test file already exists: ${outputFile}`);
    process.exit(1);
  }

  // Write file
  fs.writeFileSync(outputFile, template);

  console.log(`✅ Created test file: ${outputFile}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Open ${outputFile}`);
  console.log(`   2. Update imports and mocks`);
  console.log(`   3. Implement test cases`);
  console.log(`   4. Run: npm run test:unit -- ${outputFile}`);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
📋 Test Generator Script

Usage:
  node scripts/generate-test.cjs <type> <name> [path]

Types:
  component  - React component test
  middleware - Express middleware test
  route      - API route integration test
  e2e        - Playwright E2E test
  hook       - React hook test

Examples:
  node scripts/generate-test.cjs component FocusBoard MyWork/Focus
  node scripts/generate-test.cjs middleware rbac
  node scripts/generate-test.cjs route my-work
  node scripts/generate-test.cjs e2e myWork
  node scripts/generate-test.cjs hook useFocus
`);
  process.exit(0);
}

const [type, name, sourcePath] = args;
generateTest(type, name, sourcePath);






