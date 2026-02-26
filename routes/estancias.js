// routes/estancias.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

router.use(auth);

// ── GET /api/estancias ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q, estado } = req.query;
  try {
    const r = await pool.query(`
      SELECT e.id_estancia,
             c.placa                  AS camion,
             a.numero_anden           AS anden,
             t.nombre_turno           AS turno,
             TO_CHAR(e.hora_entrada AT TIME ZONE 'America/Mexico_City', 'HH24:MI') AS entrada,
             TO_CHAR(e.hora_salida  AT TIME ZONE 'America/Mexico_City', 'HH24:MI') AS salida,
             COALESCE(
               TO_CHAR(e.tiempo_total, 'FMHHh FMMIm'),
               CASE WHEN e.hora_entrada IS NOT NULL
                 THEN CONCAT(
                   EXTRACT(EPOCH FROM (NOW()-e.hora_entrada))::int/3600, 'h ',
                   (EXTRACT(EPOCH FROM (NOW()-e.hora_entrada))::int%3600)/60, 'm')
                 ELSE '—'
               END
             )                        AS duracion,
             e.estado_estancia        AS estado
      FROM estancia e
      JOIN camion c ON c.id_camion = e.id_camion
      JOIN anden  a ON a.id_anden  = e.id_anden
      JOIN turno  t ON t.id_turno  = e.id_turno
      WHERE ($1::text IS NULL OR c.placa ILIKE '%' || $1 || '%'
          OR CAST(a.numero_anden AS text) LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR e.estado_estancia = $2)
      ORDER BY e.id_estancia DESC`, [q || null, estado || null]);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/estancias/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT e.*, c.placa, a.numero_anden, t.nombre_turno
       FROM estancia e
       JOIN camion c ON c.id_camion = e.id_camion
       JOIN anden  a ON a.id_anden  = e.id_anden
       JOIN turno  t ON t.id_turno  = e.id_turno
       WHERE e.id_estancia = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/estancias ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { id_camion, id_anden, id_turno } = req.body;
  if (!id_camion || !id_anden || !id_turno)
    return res.status(400).json({ message: 'id_camion, id_anden e id_turno requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el andén esté libre
    const andenCheck = await client.query(
      `SELECT estado FROM anden WHERE id_anden = $1 FOR UPDATE`, [id_anden]
    );
    if (!andenCheck.rows[0])
      throw new Error('Andén no encontrado');
    if (andenCheck.rows[0].estado === 'OCUPADO')
      throw new Error('El andén ya está ocupado');

    // Verificar que el camión no tenga otra estancia activa
    const camCheck = await client.query(
      `SELECT id_estancia FROM estancia WHERE id_camion=$1 AND estado_estancia='ACTIVA'`,
      [id_camion]
    );
    if (camCheck.rows.length > 0)
      throw new Error('El camión ya tiene una estancia activa en otro andén');

    // Crear la estancia
    const r = await client.query(
      `INSERT INTO estancia (id_camion, id_anden, id_turno, hora_entrada, estado_estancia)
       VALUES ($1,$2,$3,NOW(),'ACTIVA') RETURNING *`,
      [id_camion, id_anden, id_turno]
    );

    // Marcar andén como ocupado
    await client.query(
      `UPDATE anden SET estado='OCUPADO' WHERE id_anden=$1`, [id_anden]
    );

    await client.query('COMMIT');
    res.status(201).json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: e.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/estancias/:id/finalizar ────────────────────────────────────────
router.put('/:id/finalizar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const est = await client.query(
      `SELECT * FROM estancia WHERE id_estancia=$1 AND estado_estancia='ACTIVA' FOR UPDATE`,
      [req.params.id]
    );
    if (!est.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Estancia activa no encontrada' });
    }

    const e = est.rows[0];

    // Finalizar estancia y calcular tiempo total
    const r = await client.query(
      `UPDATE estancia
       SET estado_estancia='FINALIZADA',
           hora_salida=NOW(),
           tiempo_total=NOW()-hora_entrada
       WHERE id_estancia=$1
       RETURNING *`,
      [req.params.id]
    );

    // Liberar andén
    await client.query(
      `UPDATE anden SET estado='LIBRE' WHERE id_anden=$1`, [e.id_anden]
    );

    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: e.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/estancias/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM estancia WHERE id_estancia=$1 RETURNING id_estancia', [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'No encontrado' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
