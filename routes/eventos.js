// routes/eventos.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/eventos/nuevos?desde=:id ───────────────────────────────────────
// Para polling en vivo: devuelve eventos cuyo id > desde
router.get('/nuevos', async (req, res) => {
  const desde = parseInt(req.query.desde) || 0;
  try {
    const r = await pool.query(`
      SELECT ev.*,
             c.placa,
             cam.modelo AS camara,
             a.numero_anden
      FROM evento ev
      JOIN camion c ON c.id_camion = ev.id_camion
      JOIN camara cam ON cam.id_camara = ev.id_camara
      LEFT JOIN estancia es ON es.id_camion = ev.id_camion AND es.estado_estancia = 'ACTIVA'
      LEFT JOIN anden a ON a.id_anden = es.id_anden
      WHERE ev.id_evento > $1
      ORDER BY ev.id_evento DESC
      LIMIT 20`, [desde]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/eventos/procesar-todos ─────────────────────────────────────────
router.put('/procesar-todos', async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE evento SET procesado = true WHERE procesado = false RETURNING id_evento`
    );
    res.json({ actualizados: r.rowCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/eventos ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q, tipo, estado, limit = 50 } = req.query;
  try {
    const r = await pool.query(`
      SELECT ev.id_evento,
             ev.tipo_evento,
             ev.fecha_hora,
             ev.confianza_ia,
             ev.procesado,
             ev.imagen_captura,
             c.placa,
             cam.modelo AS camara,
             a.numero_anden
      FROM evento ev
      JOIN camion c   ON c.id_camion = ev.id_camion
      JOIN camara cam ON cam.id_camara = ev.id_camara
      LEFT JOIN estancia es ON es.id_camion = ev.id_camion AND es.estado_estancia = 'ACTIVA'
      LEFT JOIN anden a ON a.id_anden = es.id_anden
      WHERE ($1::text IS NULL OR c.placa ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR ev.tipo_evento = $2)
        AND ($3::text IS NULL OR
             ($3 = 'procesado'  AND ev.procesado = true) OR
             ($3 = 'pendiente'  AND ev.procesado = false))
      ORDER BY ev.id_evento DESC
      LIMIT $4`,
      [q || null, tipo || null, estado || null, parseInt(limit)]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/eventos/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ev.*, c.placa, cam.modelo AS camara
       FROM evento ev
       JOIN camion c ON c.id_camion = ev.id_camion
       JOIN camara cam ON cam.id_camara = ev.id_camara
       WHERE ev.id_evento = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/eventos ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { id_camion, id_camara, tipo_evento, confianza_ia = 95.0 } = req.body;
  if (!id_camion || !id_camara || !tipo_evento)
    return res.status(400).json({ message: 'id_camion, id_camara y tipo_evento requeridos' });
  try {
    const r = await pool.query(
      `INSERT INTO evento (id_camion, id_camara, tipo_evento, fecha_hora, confianza_ia)
       VALUES ($1,$2,$3,NOW(),$4) RETURNING *`,
      [id_camion, id_camara, tipo_evento, confianza_ia]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── PUT /api/eventos/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { procesado } = req.body;
  try {
    const r = await pool.query(
      `UPDATE evento SET procesado=$1 WHERE id_evento=$2 RETURNING *`,
      [procesado, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── DELETE /api/eventos/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM evento WHERE id_evento=$1 RETURNING id_evento', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
