const express  = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const jwt       = require('jsonwebtoken');
const fs        = require('fs');
const path      = require('path');

// ── CONFIG ────────────────────────────────────────────────────────
const PORT       = process.env.PORT || 3001;
const JWT_SECRET = 'tacogiro_secret_2026';
const DB_FILE    = path.join(__dirname, 'tacogiro-db.json');

// Admin credentials — cambiar aquí si se quiere otra contraseña
const ADMIN = { usuario: 'admin', password: 'tacogiro2026', nombre: 'Taco Giro Admin' };

// ── BASE DE DATOS (JSON) ──────────────────────────────────────────
let db = { pedidos: [], reservaciones: [] };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { console.warn('DB nueva creada.'); }
}

function saveDB() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);           // escritura atómica — no corrompe
}

function nextId(col) {
  const items = db[col];
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}

function genNumero(prefix) {
  const d   = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rnd = String(Math.floor(Math.random()*900)+100);
  return `${prefix}-${d}-${rnd}`;
}

loadDB();

// ── EXPRESS + SOCKET.IO ───────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));      // sirve web-taco-giro.html y admin.html

// ── AUTH ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Sin token' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
}

app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body || {};
  if (usuario !== ADMIN.usuario || password !== ADMIN.password)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const token = jwt.sign({ usuario, nombre: ADMIN.nombre }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, nombre: ADMIN.nombre });
});

// ── PEDIDOS ───────────────────────────────────────────────────────
// POST /api/pedidos  — público (cliente confirma pedido)
app.post('/api/pedidos', (req, res) => {
  const { cliente_nombre, cliente_telefono, cliente_direccion, cliente_notas, items, total } = req.body;
  if (!cliente_nombre || !cliente_telefono || !cliente_direccion || !items?.length)
    return res.status(400).json({ error: 'Faltan datos del pedido' });

  const pedido = {
    id:               nextId('pedidos'),
    numero_orden:     genNumero('TG'),
    cliente_nombre,
    cliente_telefono,
    cliente_direccion,
    cliente_notas:    cliente_notas || '',
    items,
    subtotal:         total - 35,
    total,
    estado:           'pendiente',
    fecha_creacion:   new Date().toISOString(),
    actualizado_en:   new Date().toISOString(),
  };

  db.pedidos.push(pedido);
  saveDB();
  io.emit('nuevo_pedido', pedido);

  res.json({
    success:       true,
    numero_orden:  pedido.numero_orden,
    id:            pedido.id,
    mensaje:       `Pedido ${pedido.numero_orden} confirmado. ¡Llegamos en ~30 min!`,
  });
});

// GET /api/pedidos  — admin
app.get('/api/pedidos', auth, (req, res) => {
  let lista = [...db.pedidos].reverse();              // más recientes primero
  if (req.query.estado)
    lista = lista.filter(p => req.query.estado.split(',').includes(p.estado));
  res.json({ success: true, total: lista.length, pedidos: lista });
});

// PUT /api/pedidos/:id  — admin (cambiar estado)
app.put('/api/pedidos/:id', auth, (req, res) => {
  const id     = parseInt(req.params.id);
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  const ESTADOS = ['pendiente','en_preparacion','listo','en_camino','entregado','cancelado'];
  if (!ESTADOS.includes(req.body.estado))
    return res.status(400).json({ error: 'Estado inválido' });

  pedido.estado        = req.body.estado;
  pedido.actualizado_en = new Date().toISOString();
  saveDB();

  io.emit('pedido_actualizado', { id, numero_orden: pedido.numero_orden, estado_nuevo: pedido.estado });
  res.json({ success: true, estado_nuevo: pedido.estado });
});

// ── RESERVACIONES ─────────────────────────────────────────────────
// POST /api/reservaciones  — público
app.post('/api/reservaciones', (req, res) => {
  const { cliente_nombre, cliente_telefono, cliente_email,
          fecha_reserva, hora_reserva, numero_personas, mesa_preferencia, notas } = req.body;

  if (!cliente_nombre || !cliente_telefono || !fecha_reserva || !hora_reserva)
    return res.status(400).json({ error: 'Faltan datos de la reservación' });

  const reserva = {
    id:               nextId('reservaciones'),
    numero_reserva:   genNumero('RES'),
    cliente_nombre,
    cliente_telefono,
    cliente_email:    cliente_email    || '',
    fecha_reserva,
    hora_reserva,
    numero_personas:  numero_personas  || 1,
    mesa_preferencia: mesa_preferencia || '',
    notas:            notas            || '',
    estado:           'pendiente',
    fecha_creacion:   new Date().toISOString(),
    actualizado_en:   new Date().toISOString(),
  };

  db.reservaciones.push(reserva);
  saveDB();
  io.emit('nueva_reservacion', reserva);

  res.json({
    success:        true,
    numero_reserva: reserva.numero_reserva,
    id:             reserva.id,
    mensaje:        `Reservación ${reserva.numero_reserva} registrada. Te contactaremos para confirmar.`,
  });
});

// GET /api/reservaciones  — admin
app.get('/api/reservaciones', auth, (req, res) => {
  const lista = [...db.reservaciones].reverse();
  res.json({ success: true, total: lista.length, reservaciones: lista });
});

// PUT /api/reservaciones/:id  — admin
app.put('/api/reservaciones/:id', auth, (req, res) => {
  const id     = parseInt(req.params.id);
  const reserva = db.reservaciones.find(r => r.id === id);
  if (!reserva) return res.status(404).json({ error: 'Reservación no encontrada' });

  reserva.estado        = req.body.estado;
  reserva.actualizado_en = new Date().toISOString();
  saveDB();

  io.emit('reservacion_actualizada', { id, numero_reserva: reserva.numero_reserva, estado_nuevo: reserva.estado });
  res.json({ success: true, estado_nuevo: reserva.estado });
});

// ── WEBSOCKET ─────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`🟢 Admin conectado [${socket.id}]`);
  socket.on('disconnect', () => console.log(`🔴 Admin desconectado [${socket.id}]`));
});

// ── ARRANCAR ──────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════');
  console.log('  🌮  TACO GIRO — Servidor iniciado');
  console.log('══════════════════════════════════════════');
  console.log(`  Web pública : http://localhost:${PORT}/web-taco-giro.html`);
  console.log(`  Panel Admin : http://localhost:${PORT}/admin.html`);
  console.log(`  Usuario     : admin`);
  console.log(`  Contraseña  : tacogiro2026`);
  console.log('══════════════════════════════════════════\n');
});
