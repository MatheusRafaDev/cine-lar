const dgram = require('dgram');

const mac = '28:07:08:3e:9a:a5';
const macBytes = mac.split(':').map(x => parseInt(x, 16));

const magicPacket = Buffer.alloc(102);
for (let i = 0; i < 6; i++) {
    magicPacket[i] = 0xFF;
}
for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 6; j++) {
        magicPacket[6 + i * 6 + j] = macBytes[j];
    }
}

const client = dgram.createSocket('udp4');
client.bind(0, () => {
    client.setBroadcast(true);
    client.send(magicPacket, 0, magicPacket.length, 9, '192.168.15.255', (err) => {
        if (err) console.error('Erro WOL:', err);
        else console.log('Pacote WOL enviado para 28:07:08:3e:9a:a5 (192.168.15.255:9)');
        client.close();
    });
});
