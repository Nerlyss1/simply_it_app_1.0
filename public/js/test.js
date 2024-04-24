const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false
});

// Middleware pour traiter les corps de requête JSON
app.use(express.json());

// Fonction pour récupérer le nombre de likes pour un cours spécifique
async function recupererNombreLikesParCoursID(idCours) {
    try {
      const result = await pool.query('SELECT nombre_likes FROM cours WHERE id_cours = $1', [idCours]);
      if (result.rows.length === 0) {
        throw new Error('Cours non trouvé');
      }
      return parseInt(result.rows[0].nombre_likes, 10);
    } catch (error) {
      console.error('Erreur lors de la récupération du nombre de likes:', error);
      throw error;
    }
}
  
// Route pour récupérer le nombre de likes d'un cours spécifique
app.get('/cours/:id/nombre-likes', async (req, res) => {
    const idCours = req.params.id;
    try {
        const nombreLikes = await recupererNombreLikesParCoursID(idCours);
        res.json({ nombre_likes: nombreLikes });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du nombre de likes' });
    }
});
  
// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
