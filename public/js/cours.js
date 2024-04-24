const express = require('express');
const { Pool } = require('pg');
const readline = require('readline');

const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false

});

// Middleware pour traiter les corps de requête JSON
app.use(express.json());

// Fonction pour récupérer tous les cours
async function recupererTousCours() {
  try {
    const result = await pool.query('SELECT * FROM cours');
    return result.rows;
  } catch (error) {
    console.error('Erreur lors de la récupération des cours:', error);
    return { error: 'Erreur serveur' };
  }
}

module.exports = { recupererTousCours };

// // Route pour récupérer tous les cours
// app.get('/cours', async (req, res) => {
//   const cours = await recupererTousCours();
//   res.json(cours);
// });

// // Démarrer le serveur
// app.listen(port, () => {
//   console.log(`Serveur démarré sur le port ${port}`);
// });

// // Appeler la fonction pour récupérer tous les cours
// (async () => {
//   const cours = await recupererTousCours();
//   console.log(cours);
// })();
