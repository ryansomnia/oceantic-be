const express = require('express');
const router = express.Router();

// --- Import Controllers ---
// Pastikan jalur ini benar relatif terhadap routes/route.js
const user = require('../controller/user');
const participant = require('../controller/participants');
// const article = require('../controller/article');
const event = require('../controller/event');
const category = require('../controller/category');

// --- Import Middleware ---
const verifyToken = require('../middleware/auth'); // Asumsi file ini ada

// Middleware untuk otorisasi peran
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Akses ditolak: Informasi peran pengguna tidak ditemukan.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak: Anda tidak memiliki izin untuk melakukan tindakan ini.' });
    }
    next();
  };
};

// --- Rute Autentikasi (PUBLIK - TIDAK MEMERLUKAN LOGIN) ---
// Prefix /oceantic/v1 sudah ditangani di server.js
router.post('/register', user.registerUser);
router.post('/login', user.loginUser);

// --- Rute User Profile (MEMERLUKAN LOGIN) ---
router.post('/users/me', verifyToken, user.getUserProfile);
router.put('/users/me', verifyToken, user.updateUserProfile);


// // --- Rute Pendaftaran Renang (MEMERLUKAN LOGIN & OTORISASI) ---
router.post('/registrations', verifyToken, authorizeRoles(['member']), participant.registerSwimmer);
// router.get('/registrations/:id', verifyToken, authorizeRoles(['admin', 'member']), getRegistrationById);
// router.put('/registrations/:id', verifyToken, authorizeRoles(['admin']), updateRegistration);
// router.delete('/registrations/:id', verifyToken, authorizeRoles(['admin']), deleteArticle); // Perbaikan: deleteArticle
// router.get('/registrations/user/:userId', verifyToken, authorizeRoles(['admin']), getRegistrationsByUserId);
// router.get('/registrations/event/:eventId', verifyToken, authorizeRoles(['admin']), getRegistrationsByEventId);

// // --- Rute Artikel ---
// // POST /oceantic/v1/articles
// router.post('/articles', verifyToken, authorizeRoles(['admin']), createArticle);
// // GET /oceantic/v1/articles/category/:categoryName
// router.get('/articles/category/:categoryName', getArticlesByCategory);
// // GET /oceantic/v1/articles/:id
// router.get('/articles/:id', getArticleById);
// // PUT /oceantic/v1/articles/:id
// router.put('/articles/:id', verifyToken, authorizeRoles(['admin']), updateArticle);
// // DELETE /oceantic/v1/articles/:id
// router.delete('/articles/:id', verifyToken, authorizeRoles(['admin']), deleteArticle);


// --- Rute Event ---
// POST /oceantic/v1/events
router.post('/events', verifyToken, authorizeRoles(['admin']), event.createEvent);
// GET /oceantic/v1/events
router.get('/events', event.getAllEvents);

// GET /oceantic/v1/events/getAllEventsOpen
router.get('/events/getAllEventsOpen', event.getAllEventsOpen); // Menggunakan fungsi getAllEventsOpen yang spesifik
// PUT /oceantic/v1/events/:id
// router.put('/events/:id', verifyToken, authorizeRoles(['admin']), updateEvent);
// DELETE /oceantic/v1/events/:id
router.delete('/events/:id', verifyToken, authorizeRoles(['admin']), event.deleteEvent);


// --- Rute Kategori ---
// POST /oceantic/v1/categories
router.post('/categories', verifyToken, authorizeRoles(['admin']), category.createCategory);
// GET /oceantic/v1/categories/getCategoryEventByEventId/:id
router.get('/categories/getCategoryEventByEventId/:id', category.getCategoriesByEventId);
// GET /oceantic/v1/categories/by-umur (jika Anda ingin menggunakan ini)
router.get('/categories/by-umur', category.getCategoryEventByName); // Menggunakan nama yang diperbarui
// PUT /oceantic/v1/categories/:id
router.put('/categories/:id', verifyToken, authorizeRoles(['admin']), category.updateCategory);
// DELETE /oceantic/v1/categories/:id
router.delete('/categories/:id', verifyToken, authorizeRoles(['admin']), category.deleteCategory);


// Contoh Rute yang Dilindungi (opsional)
router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'Anda berhasil mengakses rute yang dilindungi di /oceantic/v1/protected!',
    user: req.user
  });
});

module.exports = router;
