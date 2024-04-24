require('dotenv').config(); 
const express = require('express');
const { recupererCoursParID } = require('./cours_id'); 
const { recupererTousCours } = require('./cours');  
const { Pool } = require('pg');
const path = require('path');
const { marked } = require('marked');
const hljs= require('highlight.js');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Configurez votre pool PostgreSQL pour accepter un certificat SSL auto-signé si nécessaire
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? {
    rejectUnauthorized: false  // Cette option ignore les erreurs de certificat SSL non valides
  } : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});

// Gestion utilisateur : 

// Middleware pour parser le corps des requêtes POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'votre_secret_ici',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }  // Mettez `true` uniquement si vous servez votre site en HTTPS
}));

// Ajout de l'utilisateur en local pour toutes les vues si l'utilisateur est connecté
app.use((req, res, next) => {
  // Si un userId est présent dans la session, nous l'ajoutons à res.locals
  if (req.session.userId) {
      res.locals.user = { id: req.session.userId };
  } else {
      res.locals.user = null; // Aucun utilisateur n'est connecté
  }
  next();
});
app.use((req, res, next) => {
  if (req.session.message) {
      res.locals.message = req.session.message;
      delete req.session.message;
  }
  next();
});

app.get('/index', (req, res) => {
  res.render('index');
});

app.get('/connexion', (req, res) => {
  res.render('connexion');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

// Route pour traiter les données du formulaire de connexion
app.post('/connexion', async (req, res) => {
  const { email, password } = req.body;

  try {
      const { rows } = await pool.query('SELECT * FROM utilisateurs WHERE email_utilisateur = $1', [email]);
      if (rows.length > 0) {
          const user = rows[0];
          const match = await bcrypt.compare(password, user.password);
          if (match) {
              req.session.userId = user.id_utilisateur;
              req.session.message = { text: 'Connexion réussie. Bienvenue !', type: 'success' };
              res.redirect('/profile');
          } else {
              res.render('connexion', { message: "Mot de passe incorrect", messageType: 'danger' });
          }
      } else {
          res.render('connexion', { message: "Aucun utilisateur trouvé avec cet email", messageType: 'danger' });
      }
  } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      res.status(500).render('connexion', { message: "Erreur serveur lors de la connexion", messageType: 'danger' });
  }
});

app.get('/profile', async (req, res) => {
  if (!req.session.userId) {
      res.redirect('/connexion'); // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
      return;
  }

  try {
      // Récupération des informations de l'utilisateur à partir de son ID en session
      const { rows } = await pool.query('SELECT * FROM utilisateurs WHERE id_utilisateur = $1', [req.session.userId]);
      const user = rows[0];

      if (!user) {
          res.status(404).send('Utilisateur non trouvé');
          return;
      }

      // Compter les commentaires postés par l'utilisateur
      const commentCountResult = await pool.query(
          'SELECT COUNT(*) AS nombre_commentaires FROM commentaires WHERE id_utilisateur = $1',
          [req.session.userId]
      );
      const nombreCommentaires = parseInt(commentCountResult.rows[0].nombre_commentaires, 10);

      // Formater la date d'inscription pour l'affichage
      if (user.date_inscription) {
          user.date_inscription = new Date(user.date_inscription).toLocaleDateString('fr-FR');
      }

      // Envoyer l'utilisateur et le nombre de commentaires à la vue
      res.render('profile_page', {
          user: user,
          nombreCommentaires: nombreCommentaires
      });
  } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      res.status(500).send('Erreur serveur lors de la récupération du profil.');
  }
});


app.get('/inscription', (req, res) => {
  res.render('inscription');
});

app.post('/inscription', async (req, res) => {
  const { email, username, password } = req.body;

  try {
      const existingUser = await pool.query('SELECT * FROM utilisateurs WHERE email_utilisateur = $1', [email]);

      if (existingUser.rows.length > 0) {
          return res.render('inscription', { error: "Un utilisateur avec cet email existe déjà" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await pool.query(
          'INSERT INTO utilisateurs (nom_utilisateur, email_utilisateur, password, date_inscription, rôles) VALUES ($1, $2, $3, NOW(), $4) RETURNING *',
          [username, email, hashedPassword, 'utilisateur']
      );

      req.session.message = {
          type: 'success',
          text: 'Inscription réussie ! Vous pouvez maintenant vous connecter.'
      };

      res.redirect('/connexion');
  } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      res.status(500).render('inscription', { error: "Erreur serveur lors de l'inscription" });
  }
});

// MANIPULATION DES COURS
// Route pour récupérer et filtrer les cours par catégorie et terme de recherche
app.get('/cours', async (req, res) => {
  try {
    let query = 'SELECT * FROM cours WHERE true';
    const params = [];
    let index = 1;

    // Filtrage par catégorie
    if (req.query.categorie) {
      query += ` AND categories = $${index}`;
      params.push(req.query.categorie);
      index++;
    }

    // Filtrage par terme de recherche
    if (req.query.search) {
      query += ` AND (titre_cours ILIKE $${index} OR description_cours ILIKE $${index})`;
      params.push(`%${req.query.search}%`);
      index++;
    }

    const result = await pool.query(query, params);

    const coursFormatted = result.rows.map(course => ({
      ...course,
      date_publication: new Date(course.date_publication).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    }));

    res.render('liste_cours', {
      cours: coursFormatted,
      searchTerm: req.query.search,
      searchCategory: req.query.categorie
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des cours:', error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des cours." });
  }
});

// Route pour rechercher des cours
app.get('/recherche', async (req, res) => {
  try {
    const searchTerm = req.query.search;  // Récupération du terme de recherche à partir de la chaîne de requête
    const cours = await recupererCoursParRecherche(searchTerm);  // Assumez que vous avez cette fonction
    res.render('liste_cours', { cours: cours, searchTerm: searchTerm });
  } catch (error) {
    console.error('Erreur lors de la recherche des cours:', error);
    res.status(500).json({ message: "Erreur serveur lors de la recherche des cours." });
  }
});

// Fonction pour récupérer les cours par recherche
async function recupererCoursParRecherche(searchTerm) {
  const result = await pool.query('SELECT * FROM cours WHERE titre_cours ILIKE $1 OR description_cours ILIKE $1', [`%${searchTerm}%`]);
  return result.rows;
}

marked.setOptions({
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  breaks: true,
  langPrefix: 'hljs language-' // Cette option préfixe les blocs de code avec des classes CSS pour le styling
});

app.get('/cours/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const cours = await recupererCoursParID(id);
    if (!cours) {
      res.status(404).render('erreur', { message: 'Cours non trouvé' });
      return;
    }

    const result = await pool.query(`
      SELECT COUNT(id_like) as nombre_likes
      FROM likes
      WHERE id_cours = $1;
    `, [id]);
    const nombreLikes = parseInt(result.rows[0].nombre_likes, 10);

    // Trouver l'ID du prochain cours
    const nextCourseResult = await pool.query(`
      SELECT id_cours FROM cours
      WHERE id_cours > $1
      ORDER BY id_cours ASC
      LIMIT 1;
    `, [id]);
    const nextCourseId = nextCourseResult.rows.length > 0 ? nextCourseResult.rows[0].id_cours : null;

    // Récupérer les commentaires pour ce cours
    const commentairesResult = await pool.query(`
      SELECT c.*, u.nom_utilisateur
      FROM commentaires c
      JOIN utilisateurs u ON u.id_utilisateur = c.id_utilisateur
      WHERE c.id_cours = $1
      ORDER BY c.date_commentaire DESC;
    `, [id]);
    const commentaires = commentairesResult.rows;

    console.log("Commentaires récupérés pour le cours ID " + id + " :", commentaires);

    const descriptionHtml = marked(cours.description_cours);

    res.render('page_cours', {
      cours: cours,
      descriptionHtml: descriptionHtml,
      nombreLikes: nombreLikes,
      nextCourseId: nextCourseId, // Passer l'ID du prochain cours à la vue
      commentaires: commentaires // Passer les commentaires à la vue
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du cours:', error);
    res.status(500).render('erreur', { message: "Erreur serveur lors de la récupération du cours." });
  }
});

// Route pour ajouter un nouveau commentaire
app.post('/ajouter-commentaire', async (req, res) => {
  // Vérifier si l'utilisateur est connecté
  if (!req.session.userId) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
    return res.redirect('/connexion');
  }

  const { texte } = req.body;
  const coursId = req.body.cours_id; // Assurez-vous d'ajouter un champ caché pour l'ID du cours dans votre formulaire

  try {
    // Insertion du nouveau commentaire dans la base de données
    await pool.query(`
      INSERT INTO commentaires (contenu, id_utilisateur, id_cours, date_commentaire)
      VALUES ($1, $2, $3, NOW())
    `, [texte, req.session.userId, coursId]);

    // Redirection vers la même page de cours avec un message de succès
    req.session.message = { type: 'success', text: 'Votre commentaire a été ajouté.' };
    res.redirect('/cours/' + coursId);
  } catch (error) {
    console.error('Erreur lors de lajout du commentaire:', error);
    req.session.message = { type: 'error', text: 'Erreur lors de lajout de votre commentaire.' };
    res.redirect('/cours/' + coursId);
  }
});

//Likes en etant connecté 
// Fonction pour créer un nouveau like
async function creerLike(utilisateur_id, cours_id) {
  try {
      const result = await pool.query('INSERT INTO likes (id_utilisateur, id_cours) VALUES ($1, $2) RETURNING *', [utilisateur_id, cours_id]);
      return result.rows[0];
  } catch (error) {
      console.error('Erreur lors de la création du like:', error);
      throw error;
  }
}

// Route pour créer un nouveau like
app.post('/likes', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ error: 'Non autorisé' });
  }
  const { cours_id } = req.body;
  try {
      const like = await creerLike(req.session.userId, cours_id);
      res.json({ message: 'Like ajouté', like });
  } catch (error) {
      res.status(500).json({ error: 'Erreur serveur' });
  }
});

// **************************MANIPULATION DES UTILISATEURS





// // Fonction pour récupérer et afficher les détails d'un utilisateur par son ID
// async function afficherUtilisateur(id) {
//   try {
//     const result = await pool.query('SELECT * FROM utilisateurs WHERE id_utilisateur = $1', [id]);
//     if (result.rows.length === 0) {
//       return { error: 'Utilisateur non trouvé' };
//     } else {
//       return result.rows[0];
//     }
//   } catch (error) {
//     console.error('Erreur lors de la récupération de l\'utilisateur:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour créer un nouvel utilisateur
// async function creerUtilisateur(id, nom, email) {
//   try {
//     const result = await pool.query('INSERT INTO utilisateurs (id_utilisateur, nom_utilisateur, email_utilisateur) VALUES ($1, $2, $3) RETURNING *', [id, nom, email]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Erreur lors de la création de l\'utilisateur:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour récupérer tous les cours
// async function recupererTousCours() {
//   try {
//     const result = await pool.query('SELECT * FROM cours');
//     return result.rows;
//   } catch (error) {
//     console.error('Erreur lors de la récupération des cours:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour créer un nouveau cours
// async function creerCours(titre, description) {
//   try {
//     const result = await pool.query('INSERT INTO cours (titre, description) VALUES ($1, $2) RETURNING *', [titre, description]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Erreur lors de la création du cours:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour récupérer tous les commentaires
// async function recupererTousCommentaires() {
//   try {
//     const result = await pool.query('SELECT * FROM commentaires');
//     return result.rows;
//   } catch (error) {
//     console.error('Erreur lors de la récupération des commentaires:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour récupérer tous les likes
// async function recupererTousLikes() {
//   try {
//     const result = await pool.query('SELECT * FROM likes');
//     return result.rows;
//   } catch (error) {
//     console.error('Erreur lors de la récupération des likes:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour créer un nouveau commentaire
// async function creerCommentaire(id_commentaire, contenu, utilisateur_id, cours_id) {
//   try {
//     const result = await pool.query('INSERT INTO commentaires (id_commentaire, contenu_commentaire, id_utilisateur, id_cours) VALUES ($1, $2, $3, $4) RETURNING *', [id_commentaire, contenu, utilisateur_id, cours_id]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Erreur lors de la création du commentaire:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour créer un nouveau like
// async function creerLike(utilisateur_id, cours_id) {
//   try {
//     const result = await pool.query('INSERT INTO likes (utilisateur_id, cours_id) VALUES ($1, $2) RETURNING *', [utilisateur_id, cours_id]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Erreur lors de la création du like:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour récupérer un cours par son ID
// async function recupererCoursParID(id) {
//   try {
//     const result = await pool.query('SELECT * FROM cours WHERE id_cours = $1', [id]);
//     if (result.rows.length === 0) {
//       return { error: 'Cours non trouvé' };
//     } else {
//       return result.rows[0];
//     }
//   } catch (error) {
//     console.error('Erreur lors de la récupération du cours:', error);
//     return { error: 'Erreur serveur' };
//   }
// }
// // Exporter la fonction recupererCoursParID
// module.exports = {
//   recupererCoursParID
// };

// // Fonction pour récupérer un commentaire par son ID
// async function recupererCommentaireParID(id) {
//   try {
//     const result = await pool.query('SELECT * FROM commentaires WHERE id_commentaire = $1', [id]);
//     if (result.rows.length === 0) {
//       return { error: 'Commentaire non trouvé' };
//     } else {
//       return result.rows[0];
//     }
//   } catch (error) {
//     console.error('Erreur lors de la récupération du commentaire:', error);
//     return { error: 'Erreur serveur' };
//   }
// }

// // Fonction pour récupérer tous les likes pour un ID de cours donné
// async function recupererLikesParCoursID(idCours) {
//   try {
//       const { data: likes, error } = await supabase
//           .from('likes')
//           .select('*')
//           .eq('cours_id', idCours);
      
//       if (error) {
//           throw error;
//       }
      
//       return likes;
//   } catch (error) {
//       throw error;
//   }
// }

// // Fonction pour récupérer tous les commentaires pour un ID de cours donné
// async function recupererCommentairesParCoursID(idCours) {
//   try {
//       const { data: commentaires, error } = await supabase
//           .from('commentaires')
//           .select('*')
//           .eq('cours_id', idCours);
      
//       if (error) {
//           throw error;
//       }
      
//       return commentaires;
//   } catch (error) {
//       throw error;
//   }
// }

// // Exemple d'utilisation des fonctions
// const idCoursExemple = '1'; // ID du cours pour lequel vous souhaitez récupérer les likes et les commentaires
// recupererLikesParCoursID(idCoursExemple)
//     .then(likes => console.log("Likes pour le cours", idCoursExemple, ":", likes))
//     .catch(error => console.error("Erreur lors de la récupération des likes :", error));

// recupererCommentairesParCoursID(idCoursExemple)
//     .then(commentaires => console.log("Commentaires pour le cours", idCoursExemple, ":", commentaires))
//     .catch(error => console.error("Erreur lors de la récupération des commentaires :", error));

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

// // Route pour afficher un commentaire par son ID
// app.get('/commentaires/:id', async (req, res) => {
//   const id = req.params.id;
//   const commentaire = await recupererCommentaireParID(id);
//   if (commentaire.error) {
//     res.status(404).json({ message: commentaire.error });
//   } else {
//     res.json(commentaire);
//   }
// });

// // Route pour afficher un utilisateur par son ID
// app.get('/utilisateurs/:id', async (req, res) => {
//   const id = req.params.id;
//   const utilisateur = await afficherUtilisateur(id);
//   if (utilisateur.error) {
//     res.status(404).json({ message: utilisateur.error });
//   } else {
//     res.json(utilisateur);
//   }
// });

// // Route pour créer un nouvel utilisateur
// app.post('/utilisateurs', async (req, res) => {
//   const { id, nom, email } = req.body;
//   const utilisateur = await creerUtilisateur(id, nom, email);
//   res.json(utilisateur);
// });

// // Route pour récupérer tous les cours
// app.get('/cours', async (req, res) => {
//   const cours = await recupererTousCours();
//   res.json(cours);
// });

// // Route pour créer un nouveau cours
// app.post('/cours', async (req, res) => {
//   const { titre, description } = req.body;
//   const cours = await creerCours(titre, description);
//   res.json(cours);
// });

// // Route pour récupérer tous les commentaires
// app.get('/commentaires', async (req, res) => {
//   const commentaires = await recupererTousCommentaires();
//   res.json(commentaires);
// });

// // Route pour récupérer tous les likes
// app.get('/likes', async (req, res) => {
//   const likes = await recupererTousLikes();
//   res.json(likes);
// });

// // Route pour créer un nouveau commentaire
// app.post('/commentaires', async (req, res) => {
//   const { id_commentaire, contenu, utilisateur_id, cours_id } = req.body;
//   const commentaire = await creerCommentaire(id_commentaire, contenu, utilisateur_id, cours_id);
//   res.json(commentaire);
// });

// // Route pour créer un nouveau like
// app.post('/likes', async (req, res) => {
//   const { utilisateur_id, cours_id } = req.body;
//   const like = await creerLike(utilisateur_id, cours_id);
//   res.json(like);
// });

