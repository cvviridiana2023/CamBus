// routes/andenes.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/andenes/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE activo = true)          AS total,
        COUNT(*) FILTER (WHERE estado = 'OCUPADO')     AS ocupados,
        COUNT(*) FILTER (WHERE estado = 'LIBRE' AND activo = true) AS libres,
        COUNT(*) FILTER (WHERE activo = false)         AS mantenimiento
      FROM anden`);
    const row = r.rows[0];
    res.json({
      total:         parseInt(row.total),
      ocupados:      parseInt(row.ocupados),
      libres:        parseInt(row.libres),
      mantenimiento: parseInt(row.mantenimiento),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/andenes ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q, estado, limit } = req.query;
  try {
    const r = await pool.query(`
      SELECT a.*,
             c.placa AS camion_actual,
             CASE
               WHEN e.hora_entrada IS NOT NULL THEN
                 EXTRACT(EPOCH FROM (NOW() - e.hora_entrada))::int
               ELSE NULL
             END AS segundos_activo
      FROM anden a
      LEFT JOIN estancia e
        ON e.id_anden = a.id_anden AND e.estado_estancia = 'ACTIVA'
      LEFT JOIN camion c ON c.id_camion = e.id_camion
      WHERE ($1::text IS NULL OR
             CAST(a.numero_anden AS text) LIKE '%' || $1 || '%' OR
             a.ubicacion ILIKE '%' || $1 || '%' OR
             a.estado ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR a.estado = $2)
      ORDER BY a.numero_anden
      ${limit ? 'LIMIT ' + parseInt(limit) : ''}`, [q || null, estado || null]);

    // Calcular duración legible
    const rows = r.rows.map(row => {
      if (row.segundos_activo != null) {
        const h = Math.floor(row.segundos_activo / 3600);
        const m = Math.floor((row.segundos_activo % 3600) / 60);
        row.duracion_actual = `${h}h ${m}m`;
      }
      return row;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/andenes/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.*, c.placa AS camion_actual
       FROM anden a
       LEFT JOIN estancia e ON e.id_anden = a.id_anden AND e.estado_estancia = 'ACTIVA'
       LEFT JOIN camion c ON c.id_camion = e.id_camion
       WHERE a.id_anden = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/andenes ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { numero_anden, estado = 'LIBRE', ubicacion, activo = true } = req.body;
  if (!numero_anden) return res.status(400).json({ message: 'Número de andén requerido' });
  try {
    const r = await pool.query(
      `INSERT INTO anden (numero_anden, estado, ubicacion, activo)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [numero_anden, estado, ubicacion, activo]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ message: 'El número de andén ya existe' });
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/andenes/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { estado, activo, ubicacion } = req.body;
  try {
    const r = await pool.query(
      `UPDATE anden SET estado=$1, activo=$2, ubicacion=$3
       WHERE id_anden=$4 RETURNING *`,
      [estado, activo, ubicacion, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/andenes/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // Verificar que no haya estancias activas
    const check = await pool.query(
      `SELECT id_estancia FROM estancia WHERE id_anden=$1 AND estado_estancia='ACTIVA'`,
      [req.params.id]
    );
    if (check.rows.length > 0)
      return res.status(409).json({ message: 'No se puede eliminar: andén con estancia activa' });

    const r = await pool.query(
      'DELETE FROM anden WHERE id_anden=$1 RETURNING id_anden', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
