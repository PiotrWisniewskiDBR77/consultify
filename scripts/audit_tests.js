
import fs from 'fs';
import path from 'path';

const root = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify';

function getFiles(dir, ext = ['.js', '.ts', '.tsx']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file, ext));
        } else {
            if (ext.includes(path.extname(file)) && !file.includes('.test.') && !file.includes('.spec.')) {
                results.push(file);
            }
        }
    });
    return results;
}

function getTestFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getTestFiles(file));
        } else {
            if (file.includes('.test.') || file.includes('.spec.')) {
                results.push(path.basename(file).replace(/\.(test|spec)\.(js|ts|tsx)$/, ''));
            }
        }
    });
    return results;
}

const backendServices = getFiles(path.join(root, 'server/services'));
const backendTests = getTestFiles(path.join(root, 'tests/unit/backend'));

const frontendServices = getFiles(path.join(root, 'services'));
const frontendTests = getTestFiles(path.join(root, 'tests/unit'));

const components = getFiles(path.join(root, 'components'));
const componentTests = getTestFiles(path.join(root, 'tests/components'));

console.log('--- MISSING BACKEND SERVICE TESTS ---');
backendServices.forEach(f => {
    const name = path.basename(f).replace(/\.(js|ts|tsx)$/, '');
    if (!backendTests.includes(name)) {
        console.log(path.relative(root, f));
    }
});

console.log('\n--- MISSING FRONTEND SERVICE TESTS ---');
frontendServices.forEach(f => {
    const name = path.basename(f).replace(/\.(js|ts|tsx)$/, '');
    if (!frontendTests.includes(name)) {
        console.log(path.relative(root, f));
    }
});

console.log('\n--- MISSING COMPONENT TESTS (Sample) ---');
let count = 0;
components.forEach(f => {
    const name = path.basename(f).replace(/\.(js|ts|tsx)$/, '');
    if (!componentTests.includes(name) && count < 20) {
        console.log(path.relative(root, f));
        count++;
    }
});
