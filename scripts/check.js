// Fast pre-bundle check: parses each file with the app's Babel config and verifies that every
// relative import resolves to a file and every named import from a local module is exported.
// Usage: node scripts/check.js [files...]   (defaults to App.js + src/**)
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
function walk(dir, out = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            if (f !== '__tests__') walk(p, out);
        } else if (/\.jsx?$/.test(f)) out.push(p);
    }
    return out;
}
const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => path.resolve(f)) : [path.join(root, 'App.js'), ...walk(path.join(root, 'src'))];

function resolveLocal(from, spec) {
    const base = path.resolve(path.dirname(from), spec);
    for (const c of [base, `${base}.js`, path.join(base, 'index.js')]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
}
const exportCache = new Map();
function exportsOf(file) {
    if (exportCache.has(file)) return exportCache.get(file);
    const ast = babel.parseSync(fs.readFileSync(file, 'utf8'), {filename: file, cwd: root});
    const names = new Set();
    let star = false;
    for (const n of ast.program.body) {
        if (n.type === 'ExportDefaultDeclaration') names.add('default');
        if (n.type === 'ExportAllDeclaration') {
            star = true;
            const target = resolveLocal(file, n.source.value);
            if (target) exportsOf(target).names.forEach((x) => x !== 'default' && names.add(x));
        }
        if (n.type === 'ExportNamedDeclaration') {
            if (n.declaration) {
                if (n.declaration.id) names.add(n.declaration.id.name);
                for (const d of n.declaration.declarations ?? []) if (d.id.name) names.add(d.id.name);
            }
            for (const s of n.specifiers ?? []) names.add(s.exported.name);
        }
    }
    const r = {names, star};
    exportCache.set(file, r);
    return r;
}

let errors = 0;
for (const file of files) {
    let ast;
    try {
        ast = babel.parseSync(fs.readFileSync(file, 'utf8'), {filename: file, cwd: root});
    } catch (e) {
        console.error(`✗ ${path.relative(root, file)}: ${e.message.split('\n')[0]}`);
        errors++;
        continue;
    }
    for (const n of ast.program.body) {
        if (n.type !== 'ImportDeclaration') continue;
        const spec = n.source.value;
        if (spec.startsWith('.')) {
            const target = resolveLocal(file, spec);
            if (!target) {
                console.error(`✗ ${path.relative(root, file)}: cannot resolve '${spec}'`);
                errors++;
                continue;
            }
            const {names} = exportsOf(target);
            for (const s of n.specifiers) {
                const name = s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportSpecifier' ? s.imported.name : null;
                if (name && !names.has(name)) {
                    console.error(`✗ ${path.relative(root, file)}: '${name}' is not exported by '${spec}'`);
                    errors++;
                }
            }
        } else {
            const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
            try {
                require.resolve(`${pkg}/package.json`, {paths: [root]});
            } catch {
                console.error(`✗ ${path.relative(root, file)}: package '${pkg}' is not installed`);
                errors++;
            }
        }
    }
}
console.log(errors ? `${errors} problem(s)` : `✓ ${files.length} files OK`);
process.exit(errors ? 1 : 0);
