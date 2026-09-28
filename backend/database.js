require('dotenv').config();
const { Pool } = require('pg');

// Configuração do pool de conexões com o Neon PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Exigido para conexões seguras (SSL) no Neon
    }
});

// Função para testar a conectividade com o banco de dados online
async function testarConexao() {
    try {
        const client = await pool.connect();
        console.log("✓ Conectado ao PostgreSQL (Neon) com sucesso!");
        client.release(); // Libera o cliente de volta para o pool de conexões
    } catch (err) {
        console.error("✗ Falha crítica de conexão com o banco Neon:", err.message);
        throw err; // Repassa o erro para ser capturado no server.js
    }
}

// Exportando tanto o pool quanto a função testarConexao
module.exports = { pool, testarConexao };