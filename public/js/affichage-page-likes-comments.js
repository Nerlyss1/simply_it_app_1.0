const express = require('express');
const { Pool } = require('pg');
const readline = require('readline');
const fetchFromModule = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));



const app = express();
const port = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres.fzgpdbawpedvljpmrjkp:INVzEweNW8yxck9O@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    ssl: process.env.DATABASE_URL ? true : false

});
// Middleware pour traiter les corps de requête JSON
app.use(express.json());

// Fonction pour récupérer un cours par son ID depuis la base de données
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

// Fonction pour récupérer les commentaires associés à un cours par son ID depuis la base de données
async function recupererCommentairesParCoursID(id) {
    try {
        const result = await pool.query('SELECT * FROM commentaires WHERE id_cours = $1', [id]);
        return result.rows;
    } catch (error) {
        console.error('Erreur lors de la récupération des commentaires:', error);
        return { error: 'Erreur serveur' };
    }
}

// Route pour récupérer un cours par son ID
app.get('/cours/:id', async (req, res) => {
    const idCours = req.params.id;
    try {
        const cours = await recupererCoursParID(idCours);
        if (cours.error) {
            res.status(404).json(cours);
            return;
        }
        
        const commentaires = await recupererCommentairesParCoursID(idCours);
        cours.commentaires = commentaires;

        res.json(cours);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du cours' });
    }
});

// Fonction pour saisir l'ID du cours depuis la ligne de commande
async function saisirIDCours() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('Entrez l\'ID du cours : ', (idCours) => {
            // Fermer l'interface de saisie
            rl.close();

            // Résoudre la promesse avec l'ID du cours saisi
            resolve(idCours);
        });
    });
}

// Appeler la fonction de saisie de l'ID du cours
async function main() {
    const idCours = await saisirIDCours();
    console.log('ID du cours saisi :', idCours);
    
    // Appeler la route pour récupérer les détails du cours
    try {
        const response = await fetch(`http://localhost:3000/cours/${idCours}`);
        const data = await response.json();
        console.log('Détails du cours :', data);
    } catch (error) {
        console.error('Erreur lors de la récupération des détails du cours :', error);
    }
}

main();

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
