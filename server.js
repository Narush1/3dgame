const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });
console.log('Server listening on ws://localhost:3000');

let players = new Map();

function broadcast(data) {
  const str = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === 'join') {
      players.set(ws, {
        nick: data.nick,
        pos: { x: 0, y: 1, z: 0 },
        msg: '',
        msgTimeout: null
      });
      // Отправить игроку текущее состояние всех
      const state = [];
      for (const [client, p] of players.entries()) {
        state.push({ nick: p.nick, pos: p.pos, msg: p.msg });
      }
      ws.send(JSON.stringify({ type: 'state', players: state }));
      broadcast({ type: 'chat', nick: 'System', message: `${data.nick} вошёл в игру` });
    }

    if (data.type === 'move') {
      const p = players.get(ws);
      if (p) {
        p.pos = data.pos;
        broadcast({ type: 'positions', players: Array.from(players.values()).map(p => ({ nick: p.nick, pos: p.pos, msg: p.msg })) });
      }
    }

    if (data.type === 'chat') {
      const p = players.get(ws);
      if (!p) return;
      p.msg = data.message;

      if (p.msgTimeout) clearTimeout(p.msgTimeout);

      p.msgTimeout = setTimeout(() => {
        p.msg = '';
        broadcast({ type: 'positions', players: Array.from(players.values()).map(p => ({ nick: p.nick, pos: p.pos, msg: p.msg })) });
      }, 3000);

      broadcast({ type: 'chat', nick: p.nick, message: data.message });
      broadcast({ type: 'positions', players: Array.from(players.values()).map(p => ({ nick: p.nick, pos: p.pos, msg: p.msg })) });
    }
  });

  ws.on('close', () => {
    const p = players.get(ws);
    if (p) {
      broadcast({ type: 'chat', nick: 'System', message: `${p.nick} вышел из игры` });
      players.delete(ws);
      broadcast({ type: 'positions', players: Array.from(players.values()).map(p => ({ nick: p.nick, pos: p.pos, msg: p.msg })) });
    }
  });
});
