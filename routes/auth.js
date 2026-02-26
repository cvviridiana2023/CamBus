// routes/auth.js
const router  = require('express').Router();
const pool    = require('../db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'cambus_secret_dev';

// ── Middleware: verificar token ──────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Token requerido' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ message: 'Correo y contraseña requeridos' });

  try {
    const r = await pool.query(
      'SELECT * FROM usuario WHERE correo = $1 AND estado = true', [correo]
    );
    const user = r.rows[0];
    if (!user) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.contrasena);
    if (!ok) return res.status(401).json({ message: 'Credenciales incorrectas' });

    // Registrar en bitácora
    const ip = req.ip || req.headers['x-forwarded-for'] || '—';
    await pool.query(
      'INSERT INTO bitacora (id_usuario, accion, ip_origen) VALUES ($1, $2, $3)',
      [user.id_usuario, `Inicio de sesión (${correo})`, ip]
    );

    const token = jwt.sign(
      { id: user.id_usuario, nombre: user.nombre, rol: user.rol },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, nombre: user.nombre, rol: user.rol });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id_usuario, nombre, correo, rol FROM usuario WHERE id_usuario = $1',
      [req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
module.exports.auth = auth; // exportar para usar en otras rutas
