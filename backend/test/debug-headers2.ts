const fd = new FormData();
fd.append('paid_amount', '100');
fd.append('buyer_note', 'test');

const server = require('http').createServer((req: any, res: any) => {
  console.log('Content-Type:', req.headers['content-type']);
  let body = '';
  req.on('data', (chunk: any) => body += chunk);
  req.on('end', () => {
    console.log('Body preview:', body.slice(0, 200));
    res.end('ok');
    server.close();
  });
});

server.listen(9998, async () => {
  await fetch('http://localhost:9998/test', {
    method: 'POST',
    headers: { Cookie: 'test=123' },
    body: fd,
  });
});
