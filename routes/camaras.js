// routes/camaras.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/camaras ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.*, a.numero_anden
      FROM camara c
      LEFT JOIN anden a ON a.id_anden = c.id_anden
      ORDER BY c.id_camara`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/camaras/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, a.numero_anden FROM camara c
       LEFT JOIN anden a ON a.id_anden = c.id_anden
       WHERE c.id_camara = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/camaras ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { modelo, ubicacion, ip, estado = 'ACTIVA', id_anden } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO camara (modelo, ubicacion, ip, estado, id_anden)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [modelo, ubicacion, ip, estado, id_anden || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/camaras/:id/toggle ──────────────────────────────────────────────
router.put('/:id/toggle', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE camara
       SET estado = CASE WHEN estado = 'ACTIVA' THEN 'INACTIVA' ELSE 'ACTIVA' END
       WHERE id_camara = $1
       RETURNING *`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/camaras/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { modelo, ubicacion, ip, estado, id_anden } = req.body;
  try {
    const r = await pool.query(
      `UPDATE camara SET modelo=$1, ubicacion=$2, ip=$3, estado=$4, id_anden=$5
       WHERE id_camara=$6 RETURNING *`,
      [modelo, ubicacion, ip, estado, id_anden || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/camaras/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM camara WHERE id_camara=$1 RETURNING id_camara', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrada' });
    res.status(204).end();
  } catch (e) {
    if (e.code === '23503')
      return res.status(409).json({ message: 'No se puede eliminar: cámara con eventos asociados' });
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
