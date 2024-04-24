const express = require('express');
const { Pool } = require('pg');
const readline = require('readline');

const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false

})
// Middleware pour traiter les corps de requête JSON
app.use(express.json());

// Fonction pour créer un nouvel utilisateur
async function creerUtilisateur(id, nom, email) {
  try {
    const result = await pool.query('INSERT INTO utilisateurs (id_utilisateur, nom_utilisateur, email_utilisateur) VALUES ($1, $2, $3) RETURNING *', [id, nom, email]);
    return result.rows[0];
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    return { error: 'Erreur serveur' };
  }
}

// Route pour créer un nouvel utilisateur
app.post('/utilisateurs', async (req, res) => {
  const { id, nom, email } = req.body;
  const utilisateur = await creerUtilisateur(id, nom, email);
  res.json(utilisateur);
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});

// Créer une interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fonction pour saisir les données de l'utilisateur
function inputUtilisateur(callback) {
  rl.question('Entrez l\'ID de l\'utilisateur : ', (id) => {
    rl.question('Entrez le nom de l\'utilisateur : ', (nom) => {
      rl.question('Entrez l\'email de l\'utilisateur : ', (email) => {
        callback({ id, nom, email });
        rl.close();
      });
    });
  });
}

// Appeler la fonction inputUtilisateur pour saisir les données de l'utilisateur
inputUtilisateur(async (donneesUtilisateur) => {
  const { id, nom, email } = donneesUtilisateur;
  const utilisateur = await creerUtilisateur(id, nom, email);
  console.log(utilisateur);
});
