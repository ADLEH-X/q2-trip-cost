const localtunnel = require('localtunnel');

(async () => {
  const tunnel = await localtunnel({ port: 3000, host: 'https://localtunnel.me' });
  console.log('YOUR PUBLIC URL IS:', tunnel.url);
  tunnel.on('close', () => {
    // tunnels are closed
  });
})();
