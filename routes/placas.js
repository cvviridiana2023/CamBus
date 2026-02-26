// routes/placas.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/placas ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    const r = await pool.query(`
      SELECT p.*,
             COALESCE(c.placa, '—') AS camion
      FROM placa p
      LEFT JOIN camion c ON c.id_camion = p.id_camion
      WHERE ($1::text IS NULL OR p.numero_placa ILIKE '%' || $1 || '%'
          OR p.pais ILIKE '%' || $1 || '%'
          OR p.estado ILIKE '%' || $1 || '%')
      ORDER BY p.id_placa DESC`, [q || null]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/placas ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { numero_placa, pais, estado, id_camion } = req.body;
  if (!numero_placa) return res.status(400).json({ message: 'Número de placa requerido' });
  try {
    const r = await pool.query(
      `INSERT INTO placa (numero_placa, pais, estado, id_camion)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [numero_placa.toUpperCase(), pais, estado, id_camion || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'La placa ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/placas/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { numero_placa, pais, estado, id_camion } = req.body;
  try {
    const r = await pool.query(
      `UPDATE placa SET numero_placa=$1, pais=$2, estado=$3, id_camion=$4
       WHERE id_placa=$5 RETURNING *`,
      [numero_placa?.toUpperCase(), pais, estado, id_camion || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/placas/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM placa WHERE id_placa=$1 RETURNING id_placa', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
