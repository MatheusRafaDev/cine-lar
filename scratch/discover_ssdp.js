const dgram = require('dgram');

const client = dgram.createSocket('udp4');

client.on('message', (msg, rinfo) => {
    console.log(`Mensagem de ${rinfo.address}:${rinfo.port}`);
    console.log(msg.toString());
});

client.bind(0, () => {
    client.setBroadcast(true);
    const search = 
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 2\r\n' +
        'ST: ssdp:all\r\n\r\n';
    
    client.send(Buffer.from(search), 0, search.length, 1900, '239.255.255.250', (err) => {
        if (err) console.error('Erro envio SSDP:', err);
    });
});

setTimeout(() => {
    console.log('Fim da escuta SSDP.');
    client.close();
    process.exit(0);
}, 3000);
