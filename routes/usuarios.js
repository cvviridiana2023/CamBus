// routes/usuarios.js
const router  = require('express').Router();
const pool    = require('../db');
const bcrypt  = require('bcryptjs');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/usuarios ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q, rol } = req.query;
  try {
    const r = await pool.query(`
      SELECT id_usuario, nombre, correo, rol, estado, fecha_creacion
      FROM usuario
      WHERE ($1::text IS NULL OR nombre ILIKE '%' || $1 || '%'
          OR correo ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR rol = $2)
      ORDER BY id_usuario`, [q || null, rol || null]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/usuarios/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id_usuario, nombre, correo, rol, estado, fecha_creacion FROM usuario WHERE id_usuario=$1',
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/usuarios ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { nombre, correo, password, rol = 'OPERADOR' } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ message: 'Nombre, correo y contraseña requeridos' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena, rol)
       VALUES ($1,$2,$3,$4) RETURNING id_usuario, nombre, correo, rol, estado, fecha_creacion`,
      [nombre, correo, hash, rol]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'El correo ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/usuarios/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { nombre, correo, rol, password } = req.body;
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query = `UPDATE usuario SET nombre=$1, correo=$2, rol=$3, contrasena=$4
               WHERE id_usuario=$5
               RETURNING id_usuario, nombre, correo, rol, estado, fecha_creacion`;
      params = [nombre, correo, rol, hash, req.params.id];
    } else {
      query = `UPDATE usuario SET nombre=$1, correo=$2, rol=$3
               WHERE id_usuario=$4
               RETURNING id_usuario, nombre, correo, rol, estado, fecha_creacion`;
      params = [nombre, correo, rol, req.params.id];
    }
    const r = await pool.query(query, params);
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'El correo ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/usuarios/:id/toggle-estado ─────────────────────────────────────
router.put('/:id/toggle-estado', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE usuario SET estado = NOT estado
       WHERE id_usuario=$1
       RETURNING id_usuario, nombre, estado`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/usuarios/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  // No permitir eliminar al propio usuario
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
  try {
    const r = await pool.query(
      'DELETE FROM usuario WHERE id_usuario=$1 RETURNING id_usuario', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
