// routes/bitacora.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/bitacora ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    const r = await pool.query(`
      SELECT b.id_bitacora,
             COALESCE(u.nombre, 'Sistema') AS usuario,
             b.accion,
             b.ip_origen AS ip,
             TO_CHAR(b.fecha AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS') AS fecha
      FROM bitacora b
      LEFT JOIN usuario u ON u.id_usuario = b.id_usuario
      WHERE ($1::text IS NULL OR
             u.nombre ILIKE '%' || $1 || '%' OR
             b.accion ILIKE '%' || $1 || '%' OR
             b.ip_origen ILIKE '%' || $1 || '%')
      ORDER BY b.id_bitacora DESC
      LIMIT 200`, [q || null]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/bitacora ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { accion } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || '—';
  try {
    const r = await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, ip_origen)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, accion, ip]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/bitacora ─────────────────────────────────────────────────────
// Limpiar todos los registros
router.delete('/', async (req, res) => {
  try {
    await pool.query('TRUNCATE bitacora RESTART IDENTITY');
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
