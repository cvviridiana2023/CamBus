// routes/turnos.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/turnos ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM turno ORDER BY id_turno');
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/turnos/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM turno WHERE id_turno=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/turnos ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { nombre_turno, hora_inicio, hora_fin } = req.body;
  if (!nombre_turno || !hora_inicio || !hora_fin)
    return res.status(400).json({ message: 'Nombre, hora_inicio y hora_fin requeridos' });
  try {
    const r = await pool.query(
      `INSERT INTO turno (nombre_turno, hora_inicio, hora_fin)
       VALUES ($1,$2,$3) RETURNING *`,
      [nombre_turno, hora_inicio, hora_fin]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/turnos/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { nombre_turno, hora_inicio, hora_fin, activo } = req.body;
  try {
    const r = await pool.query(
      `UPDATE turno SET nombre_turno=$1, hora_inicio=$2, hora_fin=$3, activo=$4
       WHERE id_turno=$5 RETURNING *`,
      [nombre_turno, hora_inicio, hora_fin, activo, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/turnos/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT id_estancia FROM estancia WHERE id_turno=$1 LIMIT 1`, [req.params.id]
    );
    if (check.rows.length > 0)
      return res.status(409).json({ message: 'No se puede eliminar: turno con estancias asociadas' });

    const r = await pool.query(
      'DELETE FROM turno WHERE id_turno=$1 RETURNING id_turno', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
