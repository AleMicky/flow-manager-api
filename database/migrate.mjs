import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Cargar variables de .env si existe
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const { Client } = pg;

async function runMigrations() {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? 'workflowdb',
  });

  const sqlPath = path.join(__dirname, 'migrations', '001_init_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log(
    `Conectando a PostgreSQL (${client.host}:${client.port}/${client.database})...`,
  );
  await client.connect();

  try {
    console.log('Ejecutando migración centralizada: 001_init_schema.sql...');
    await client.query(sql);
    console.log('✅ Migración y datos semilla ejecutados correctamente.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('❌ Error al ejecutar la migración:', err.message || err);
  process.exit(1);
});

