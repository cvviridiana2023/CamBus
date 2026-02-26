// db.js — Pool de conexión a PostgreSQL
// Todos los archivos de rutas importan este módulo con: const pool = require('../db');

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'CamBus',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

// Verificar conexión al arrancar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ ERROR al conectar a PostgreSQL:', err.message);
    console.error('   Revisa los valores en tu archivo .env');
  } else {
    console.log('✅ Conectado a PostgreSQL correctamente');
    release();
  }
});

module.exports = pool;
