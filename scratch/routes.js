const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\rafae\\.tizen-extension-platform\\server\\dist\\index.js', 'utf8');
const regex = /['"]\/api\/v1\/([^'"]+)['"]/g;
let m;
const routes = new Set();
while ((m = regex.exec(content)) !== null) {
    routes.add(m[1]);
}
console.log(Array.from(routes));
