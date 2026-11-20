const net = require('net');

async function checkPort(ip, port, timeout = 250) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, ip);
    });
}

async function run() {
    const promises = [];
    for (let i = 2; i <= 254; i++) {
        const ip = `192.168.15.${i}`;
        promises.push(
            (async () => {
                const [p8001, p8002, p26101] = await Promise.all([
                    checkPort(ip, 8001, 300),
                    checkPort(ip, 8002, 300),
                    checkPort(ip, 26101, 300)
                ]);
                if (p8001 || p8002 || p26101) {
                    console.log(`ALVO ENCONTRADO: ${ip} -> 8001:${p8001}, 8002:${p8002}, 26101:${p26101}`);
                }
            })()
        );
    }
    await Promise.all(promises);
    console.log('Varredura completa concluida.');
}

run();
