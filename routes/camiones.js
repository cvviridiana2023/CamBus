// routes/camiones.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/camiones ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    const r = await pool.query(`
      SELECT c.*,
             COUNT(e.id_estancia) AS estancias
      FROM camion c
      LEFT JOIN estancia e ON e.id_camion = c.id_camion
      WHERE ($1::text IS NULL OR c.placa ILIKE '%' || $1 || '%'
          OR c.empresa ILIKE '%' || $1 || '%'
          OR c.tipo ILIKE '%' || $1 || '%')
      GROUP BY c.id_camion
      ORDER BY c.id_camion DESC`, [q || null]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/camiones/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM camion WHERE id_camion = $1', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/camiones ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { placa, tipo, empresa } = req.body;
  if (!placa || !empresa)
    return res.status(400).json({ message: 'Placa y empresa son requeridas' });
  try {
    const r = await pool.query(
      'INSERT INTO camion (placa, tipo, empresa) VALUES ($1,$2,$3) RETURNING *',
      [placa.toUpperCase(), tipo, empresa]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'La placa ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/camiones/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { placa, tipo, empresa } = req.body;
  try {
    const r = await pool.query(
      `UPDATE camion SET placa=$1, tipo=$2, empresa=$3
       WHERE id_camion=$4 RETURNING *`,
      [placa?.toUpperCase(), tipo, empresa, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'La placa ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/camiones/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM camion WHERE id_camion=$1 RETURNING id_camion', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    if (e.code === '23503')
      return res.status(409).json({ message: 'No se puede eliminar: tiene estancias o eventos asociados' });
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
