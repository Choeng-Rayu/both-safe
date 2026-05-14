// Test what headers Node.js fetch sends with FormData

const fd = new FormData();
fd.append('test_field', 'test_value');

const server = require('http').createServer((req: any, res: any) => {
  console.log('Received headers:', JSON.stringify(req.headers));
  let body = '';
  req.on('data', (chunk: any) => body += chunk);
  req.on('end', () => {
    console.log('Body length:', body.length);
    console.log('Body starts with:', body.slice(0, 100));
    res.end('ok');
    server.close();
  });
});

server.listen(9999, async () => {
  await fetch('http://localhost:9999/test', {
    method: 'POST',
    body: fd,
  });
});
