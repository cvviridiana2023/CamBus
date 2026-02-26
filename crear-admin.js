// crear-admin.js
// ────────────────────────────────────────────────────────────────────────────
// Ejecuta este script UNA SOLA VEZ para crear el primer usuario ADMIN.
// Uso:  node crear-admin.js
// ────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const pool   = require('./db');
const bcrypt = require('bcryptjs');

// ── EDITA ESTOS VALORES ─────────────────────────────────────────────────────
const NOMBRE   = 'Administrador';
const CORREO   = 'viri@cambus.mx';
const PASSWORD = '1234';  // ← Cámbialo antes de ejecutar
const ROL      = 'ADMIN';
// ────────────────────────────────────────────────────────────────────────────

async function crearAdmin() {
  try {
    // Hashear la contraseña con bcrypt (costo 10)
    const hash = await bcrypt.hash(PASSWORD, 10);

    const r = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena, rol)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (correo) DO NOTHING
       RETURNING id_usuario, nombre, correo, rol`,
      [NOMBRE, CORREO, hash, ROL]
    );

    if (r.rows[0]) {
      console.log('✅ Usuario ADMIN creado:');
      console.log(`   ID:     ${r.rows[0].id_usuario}`);
      console.log(`   Nombre: ${r.rows[0].nombre}`);
      console.log(`   Correo: ${r.rows[0].correo}`);
      console.log(`   Rol:    ${r.rows[0].rol}`);
      console.log('');
      console.log('🔑 Credenciales de acceso:');
      console.log(`   Correo:     ${CORREO}`);
      console.log(`   Contraseña: ${PASSWORD}`);
    } else {
      console.log('⚠️  El correo ya existe en la base de datos. No se creó nada.');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    process.exit();
  }
}

crearAdmin();
