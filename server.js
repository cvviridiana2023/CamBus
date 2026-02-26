// server.js — Punto de entrada del servidor CamBus API
// Inicia con: node server.js  (o: npm run dev  si tienes nodemon)

const express = require('express');
const cors    = require('cors');
require('dotenv').config();
require('./db');

const app = express();

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors()); // Permite llamadas desde el HTML (cualquier origen en desarrollo)
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/camiones',  require('./routes/camiones'));
app.use('/api/andenes',   require('./routes/andenes'));
app.use('/api/eventos',   require('./routes/eventos'));
app.use('/api/estancias', require('./routes/estancias'));
app.use('/api/turnos',    require('./routes/turnos'));
app.use('/api/placas',    require('./routes/placas'));
app.use('/api/usuarios',  require('./routes/usuarios'));
app.use('/api/bitacora',  require('./routes/bitacora'));
app.use('/api/reportes',  require('./routes/reportes'));
app.use('/api/camaras',   require('./routes/camaras'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Iniciar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚌 CamBus API corriendo en http://localhost:${PORT}`);
  console.log(`   Prueba: http://localhost:${PORT}/api/health`);
});
