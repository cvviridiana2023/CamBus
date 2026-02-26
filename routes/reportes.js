// routes/reportes.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/reportes ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT r.id_reporte,
             r.tipo_reporte,
             CONCAT(
               TO_CHAR(r.fecha_inicio, 'YYYY-MM-DD'),
               ' a ',
               TO_CHAR(r.fecha_fin,   'YYYY-MM-DD')
             ) AS periodo,
             COALESCE(u.nombre, 'Sistema') AS generado_por,
             r.fecha_generacion
      FROM reporte r
      LEFT JOIN usuario u ON u.id_usuario = r.generado_por
      ORDER BY r.id_reporte DESC`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/reportes ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { tipo_reporte, fecha_inicio, fecha_fin } = req.body;
  const now = new Date();
  const inicio = fecha_inicio || new Date(now.getTime() - 7 * 86400000).toISOString();
  const fin    = fecha_fin    || now.toISOString();
  try {
    const r = await pool.query(
      `INSERT INTO reporte (tipo_reporte, fecha_inicio, fecha_fin, generado_por)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tipo_reporte, inicio, fin, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/reportes/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM reporte WHERE id_reporte=$1 RETURNING id_reporte', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
