const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;

const root = path.join(__dirname, 'app', 'dist');
const output = path.join(__dirname, 'formatted');
for (const relative of ['main/main.js', 'main/preload.js', 'main/mic-monitor-worker.js', 'renderer/renderer.js']) {
  const sourcePath = path.join(root, relative);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const ast = parser.parse(source, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true,
    errorRecovery: false,
    plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread', 'topLevelAwait']
  });
  const result = generate(ast, { compact: false, concise: false, comments: true, retainLines: false }, source);
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, result.code + '\n', { flag: 'wx' });
  console.log(`${relative}: ${result.code.split('\n').length} formatted lines`);
}
