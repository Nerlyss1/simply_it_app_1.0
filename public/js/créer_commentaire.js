const express = require('express');
const { Pool } = require('pg');
const readline = require('readline');

const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false

});

// Fonction pour créer un nouveau commentaire
async function creerCommentaire(id_commentaire, contenu, utilisateur_id, cours_id) {
  try {
    const result = await pool.query('INSERT INTO commentaires (id_commentaire, contenu_commentaire, id_utilisateur, id_cours) VALUES ($1, $2, $3, $4) RETURNING *', [id_commentaire, contenu, utilisateur_id, cours_id]);
    return result.rows[0];
  } catch (error) {
    console.error('Erreur lors de la création du commentaire:', error);
    return { error: 'Erreur serveur' };
  }
}

// Route pour créer un nouveau commentaire
app.post('/commentaires', async (req, res) => {
    const { id_commentaire, contenu, utilisateur_id, cours_id } = req.body;
    const commentaire = await creerCommentaire(id_commentaire, contenu, utilisateur_id, cours_id);
    res.json(commentaire);
});

// Créer une interface readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Fonction pour saisir les données du commentaire
  function inputCommentaire(callback) {
    rl.question('Entrez l\'identifiant du commentaire : ', (id_commentaire) => {
      rl.question('Entrez le contenu du commentaire : ', (contenu) => {
        rl.question('Entrez l\'identifiant de l\'utilisateur : ', (utilisateur_id) => {
          rl.question('Entrez l\'identifiant du cours : ', (cours_id) => {
            callback({ id_commentaire, contenu, utilisateur_id, cours_id });
            rl.close();
          });
        });
      });
    });
  }
  
  // Appeler la fonction inputCommentaire pour saisir les données du commentaire
  inputCommentaire(async (donneesCommentaire) => {
    const { id_commentaire, contenu, utilisateur_id, cours_id } = donneesCommentaire;
    const commentaire = await creerCommentaire(id_commentaire, contenu, utilisateur_id, cours_id);
    console.log(commentaire);
  });

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
  });
