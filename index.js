var server = require('http').createServer()
  , url = require('url')
  , WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ server: server })
  , express = require('express')
  , app = express()
  , port = 1234;
var count = 0;
var ws1;
var wslist = [];
// static express server
app.use(express.static('./static'));
server.on('request', app);
server.listen(port, function () { console.log('Listening on ' + server.address().port) });

// listen socket and broadcast msg to other
wss.on('connection', function (ws){
    count++;
    console.log('wss connection count: '+ count);
    if (count === 1) ws1= ws;
    wslist.push(ws)
    ws.on('message', function (msg){
        console.log('received: %s', msg);
        if(ws === ws1){
            wss.clients.forEach(function(other){
                if (other === ws){
                    return;
                }else{
                    other.send(msg);
                }
            });
        }else{
            ws1.send(msg);
        }
    });
    ws1.on('close', function() {
        process.exit(1);
    })
});
