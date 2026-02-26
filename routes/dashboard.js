// routes/dashboard.js
const router = require('express').Router();
const pool   = require('../db');
const { auth } = require('./auth');

// ── GET /api/dashboard/kpis ──────────────────────────────────────────────────
router.get('/kpis', auth, async (req, res) => {
  try {
    const [camiones, andenes, eventos, alertas] = await Promise.all([
      // Camiones activos (con estancia ACTIVA)
      pool.query(`SELECT COUNT(DISTINCT id_camion) AS total
                  FROM estancia WHERE estado_estancia = 'ACTIVA'`),
      // Andenes ocupados
      pool.query(`SELECT COUNT(*) AS total FROM anden WHERE estado = 'OCUPADO' AND activo = true`),
      // Eventos de hoy
      pool.query(`SELECT COUNT(*) AS total FROM evento
                  WHERE fecha_hora::date = CURRENT_DATE`),
      // Alertas pendientes (eventos no procesados de baja confianza o sin procesar de hoy)
      pool.query(`SELECT COUNT(*) AS total FROM evento
                  WHERE procesado = false AND fecha_hora::date = CURRENT_DATE`),
    ]);

    res.json({
      camionesActivos:   parseInt(camiones.rows[0].total),
      andenesOcupados:   parseInt(andenes.rows[0].total),
      eventosHoy:        parseInt(eventos.rows[0].total),
      alertasPendientes: parseInt(alertas.rows[0].total),
    });
  } catch (e) {
    console.error('KPIs error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
