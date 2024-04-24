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

// Fonction pour récupérer un cours par son ID
async function recupererCoursParID(id) {
  try {
    const result = await pool.query('SELECT * FROM cours WHERE id_cours = $1', [id]);
    if (result.rows.length === 0) {
      return { error: 'Cours non trouvé' };
    } else {
      return result.rows[0];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du cours:', error);
    return { error: 'Erreur serveur' };
  }
}

module.exports = { recupererCoursParID };


// // Route pour afficher un cours par son ID
// app.get('/cours/:id', async (req, res) => {
//   const id = req.params.id;
//   const cours = await recupererCoursParID(id);
//   if (cours.error) {
//     res.status(404).json({ message: cours.error });
//   } else {
//     res.json(cours);
//   }
// });

// // Démarrer le serveur
// app.listen(port, () => {
//   console.log(`Serveur démarré sur le port ${port}`);
// });

// // Définir une fonction asynchrone pour tester la récupération d'un cours par ID
// async function testerRecuperationCoursParID() {
//   // ID du cours que vous souhaitez récupérer
//   const idCours = '1';

//   // Appeler la fonction pour récupérer le cours par ID
//   const cours = await recupererCoursParID(idCours);

//   // Afficher le résultat
//   console.log(cours);
// }

// // Appeler la fonction de test
// testerRecuperationCoursParID();
