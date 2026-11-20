const net = require('net');

async function checkPort(ip, port, timeout = 300) {
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
    console.log('Varrendo rede 192.168.15.1 - 192.168.15.50 para portas 8001 e 26101...');
    for (let i = 1; i <= 50; i++) {
        const ip = `192.168.15.${i}`;
        const [is8001, is26101] = await Promise.all([
            checkPort(ip, 8001, 250),
            checkPort(ip, 26101, 250)
        ]);
        if (is8001 || is26101) {
            console.log(`Dispositivo encontrado: ${ip} -> Port 8001: ${is8001}, Port 26101 (SDB): ${is26101}`);
        }
    }
    console.log('Varredura concluida.');
}

run();
