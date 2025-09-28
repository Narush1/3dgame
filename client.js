let socket;
let nick = '';
let players = new Map();

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const nicknameOverlay = document.getElementById('nicknameOverlay');
const nickInput = document.getElementById('nickInput');

function joinGame() {
  const val = nickInput.value.trim();
  if (!val) return alert('Введите ник!');
  nick = val;
  nicknameOverlay.style.display = 'none';

  socket = new WebSocket('ws://localhost:3000');

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'join', nick }));
  };

  socket.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'state') {
      players.clear();
      data.players.forEach(p => players.set(p.nick, p));
      updatePlayers();
    }
    if (data.type === 'positions') {
      players.clear();
      data.players.forEach(p => players.set(p.nick, p));
      updatePlayers();
    }
    if (data.type === 'chat') {
      addChatMessage(data.nick, data.message);
    }
  };

  socket.onclose = () => {
    alert('Соединение потеряно');
    location.reload();
  };

  initThree();
  animate();
}

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'chat', message: msg }));
  chatInput.value = '';
}

function addChatMessage(nick, message) {
  const div = document.createElement('div');
  div.innerHTML = `<b>${nick}:</b> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -------- Three.js Setup --------

let scene, camera, renderer;
let playerMeshes = new Map();

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Пол
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshPhongMaterial({color:0x555555});
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // Свет
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10,20,10);
  scene.add(dirLight);

  window.addEventListener('resize', onWindowResize);

  setupControls();
}

function onWindowResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let playerSpeed = 0.1;
let localPlayerMesh = null;

function setupControls() {
  // Создаем меш локального игрока
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const material = new THREE.MeshStandardMaterial({color: 0x00ff00});
  localPlayerMesh = new THREE.Mesh(geometry, material);
  scene.add(localPlayerMesh);
  players.set(nick, { nick, pos: { x:0, y:1, z:0 }, msg: '' });
  playerMeshes.set(nick, localPlayerMesh);
}

function animate() {
  requestAnimationFrame(animate);

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    renderer.render(scene, camera);
    return;
  }

  // Управление локальным игроком
  const p = players.get(nick);
  if (!p) return;

  let moved = false;

  if (keys['w'] || keys['arrowup']) { p.pos.z -= playerSpeed; moved = true; }
  if (keys['s'] || keys['arrowdown']) { p.pos.z += playerSpeed; moved = true; }
  if (keys['a'] || keys['arrowleft']) { p.pos.x -= playerSpeed; moved = true; }
  if (keys['d'] || keys['arrowright']) { p.pos.x += playerSpeed; moved = true; }

  p.pos.y = 1;

  if (moved) {
    socket.send(JSON.stringify({ type: 'move', pos: p.pos }));
  }

  updatePlayers();

  renderer.render(scene, camera);
}

function updatePlayers() {
  players.forEach((p, key) => {
    let mesh = playerMeshes.get(key);
    if (!mesh) {
      const geometry = new THREE.BoxGeometry(1, 2, 1);
      const material = new THREE.MeshStandardMaterial({color: 0x0077ff});
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      playerMeshes.set(key, mesh);

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;

      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(0, 2.5, 0);
      sprite.scale.set(3, 0.75, 1);
      mesh.add(sprite);

      mesh.userData = { canvas, ctx, texture, sprite };
    }

    mesh.position.set(p.pos.x, p.pos.y, p.pos.z);

    const { canvas, ctx, texture } = mesh.userData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(p.nick, canvas.width / 2, 30);

    if (p.msg) {
      ctx.font = '24px Arial';
      ctx.fillStyle = 'yellow';
      ctx.fillText(p.msg, canvas.width / 2, 60);
    }

    texture.needsUpdate = true;
  });

  // Удаление отключившихся
  [...playerMeshes.keys()].forEach(key => {
    if (!players.has(key)) {
      const mesh = playerMeshes.get(key);
      scene.remove(mesh);
      playerMeshes.delete(key);
    }
  });
}
