const express = require('express');
const { Pool } = require('pg');
const readline = require('readline');

const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false
});

// Fonction pour créer un nouveau like
async function creerLike(utilisateur_id, cours_id) {
  try {
    const result = await pool.query('INSERT INTO likes (id_utilisateur, id_cours) VALUES ($1, $2) RETURNING *', [utilisateur_id, cours_id]);
    return result.rows[0];
  } catch (error) {
    console.error('Erreur lors de la création du like:', error);
    return { error: 'Erreur serveur' };
  }
}

// Route pour créer un nouveau like
app.post('/likes', async (req, res) => {
    const { utilisateur_id, cours_id } = req.body;
    const like = await creerLike(utilisateur_id, cours_id);
    res.json(like);
});

// Créer une interface readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Fonction pour saisir les données utilisateur depuis la ligne de commande
function saisirNouveauLike(callback) {
    rl.question('Entrez l\'identifiant de l\'utilisateur : ', (utilisateur_id) => {
        rl.question('Entrez l\'identifiant du cours : ', (cours_id) => {
            callback({ utilisateur_id, cours_id });
            rl.close();
        });
    });
}

// Appeler la fonction pour saisir les données du like
saisirNouveauLike(async (donneesLike) => {
    const { utilisateur_id, cours_id } = donneesLike;
    const like = await creerLike(utilisateur_id, cours_id);
    console.log(like);
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
