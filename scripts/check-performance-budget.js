#!/usr/bin/env node
/**
 * Performance Budget Checker
 * Compares current performance metrics against baseline and thresholds
 */

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, '../tests/performance/baselines/baseline.json');
const DIST_PATH = path.join(__dirname, '../dist');

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.warn('Baseline file not found, using defaults');
    return {
      metrics: {
        'bundle-size': {
          main: { threshold: 1536 },
          'total-js': { threshold: 5120 }
        }
      }
    };
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function getBundleSizes() {
  if (!fs.existsSync(DIST_PATH)) {
    return null;
  }

  const files = fs.readdirSync(DIST_PATH, { recursive: true });
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  let mainSize = 0;
  let totalSize = 0;

  jsFiles.forEach(file => {
    const filePath = path.join(DIST_PATH, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.ceil(stats.size / 1024);
    
    totalSize += sizeKB;
    
    if (file.includes('index') || file.includes('main')) {
      mainSize += sizeKB;
    }
  });

  return {
    main: mainSize,
    total: totalSize
  };
}

function checkPerformanceBudget() {
  const baseline = loadBaseline();
  const bundleSizes = getBundleSizes();

  if (!bundleSizes) {
    console.log('⚠️  Dist directory not found, skipping bundle size check');
    return 0;
  }

  const mainThreshold = baseline.metrics['bundle-size']?.main?.threshold || 1536;
  const totalThreshold = baseline.metrics['bundle-size']?.['total-js']?.threshold || 5120;

  console.log('📊 Performance Budget Check\n');
  console.log(`Main bundle: ${bundleSizes.main}KB (threshold: ${mainThreshold}KB)`);
  console.log(`Total JS: ${bundleSizes.total}KB (threshold: ${totalThreshold}KB)\n`);

  let failed = false;

  if (bundleSizes.main > mainThreshold) {
    console.error(`❌ Main bundle (${bundleSizes.main}KB) exceeds threshold (${mainThreshold}KB)`);
    failed = true;
  } else {
    console.log(`✅ Main bundle within threshold`);
  }

  if (bundleSizes.total > totalThreshold) {
    console.warn(`⚠️  Total JS (${bundleSizes.total}KB) exceeds threshold (${totalThreshold}KB)`);
    // Warning only, don't fail
  } else {
    console.log(`✅ Total JS within threshold`);
  }

  return failed ? 1 : 0;
}

if (require.main === module) {
  process.exit(checkPerformanceBudget());
}

module.exports = { checkPerformanceBudget };

