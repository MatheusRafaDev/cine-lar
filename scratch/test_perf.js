const http = require('http');

function fetchUrl(url) {
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ time: Date.now() - t0, status: res.statusCode, size: data.length });
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('Testando 7 chamadas concorrentes...');
    const urls = [
        'http://localhost:8085/api/catalog?limit=60&sort=trending',
        'http://localhost:8085/api/catalog?limit=60&sort=newest',
        'http://localhost:8085/api/catalog?limit=60&genre=Action',
        'http://localhost:8085/api/catalog?limit=60&genre=Adventure',
        'http://localhost:8085/api/catalog?limit=60&genre=Comedy',
        'http://localhost:8085/api/catalog?limit=60&genre=Sci-Fi',
        'http://localhost:8085/api/catalog?limit=60&genre=Animation',
        'http://localhost:8085/api/local-movies',
        'http://localhost:8085/api/history',
        'http://localhost:8085/api/favorites'
    ];
    const tStart = Date.now();
    const results = await Promise.all(urls.map(u => fetchUrl(u)));
    const totalTime = Date.now() - tStart;
    console.log(`Tempo total das 10 chamadas: ${totalTime}ms`);
    results.forEach((r, i) => console.log(`  Req ${i + 1}: ${r.time}ms (size: ${r.size} bytes)`));
}

run();
