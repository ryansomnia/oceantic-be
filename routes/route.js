const express = require('express');
const router = express.Router();

// --- Import Controllers ---
// Pastikan jalur ini benar relatif terhadap routes/route.js
const user = require('../controller/user');
const participant = require('../controller/participants');
// const article = require('../controller/article');
const event = require('../controller/event');
const category = require('../controller/category');
// const multer = require('multer');


// --- Import Middleware ---
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const raceCategories = require('../controller/raceCategories');
const heatDetails = require('../controller/heatDetail');
const heatSwimmer = require('../controller/heatSwimmer');
const article = require('../controller/articles');


// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//       cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//       const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//       cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // Batasi ukuran file hingga 5MB
//   fileFilter: (req, file, cb) => {
//       const filetypes = /jpeg|jpg|png/;
//       const mimetype = filetypes.test(file.mimetype);
//       const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

//       if (mimetype && extname) {
//           return cb(null, true);
//       }
//       cb(new Error('Tipe file hanya mendukung JPG, JPEG, atau PNG!'));
//   }
// });
// // Middleware untuk otorisasi peran


// --- Rute Autentikasi (PUBLIK - TIDAK MEMERLUKAN LOGIN) ---
// Prefix /oceantic/v1 sudah ditangani di server.js
router.post('/register', user.registerUser);
router.post('/createUser',verifyToken, authorizeRoles(['admin']), user.registerUser);

router.post('/login', user.loginUser);
router.get('/getAllUsers',verifyToken, authorizeRoles(['admin']), user.getAllUsers);
router.get('/getUserById/:id', verifyToken, authorizeRoles(['admin']), user.getUserById);
router.put('/updateUserProfile/:id',verifyToken, authorizeRoles(['admin']), user.updateUserProfile);
router.delete('/deleteUser/:id',verifyToken, authorizeRoles(['admin']), user.deleteUser);


// --- Rute User Profile (MEMERLUKAN LOGIN) ---
router.post('/users/me', verifyToken, user.getUserProfile);
router.put('/users/me', verifyToken, user.updateUserProfile);

router.get('/getAllParticipants', participant.getAllParticipants);
router.get('/getRegistrationById/:id', participant.getRegistrationById);
router.get('/registrations/getRegistrationByUserId/:userId', participant.getRegistrationByUserId);

// router.put('/editParticipant/:id', participant.editParticipant);
// router.delete('/deleteParticipant/:id', participant.deleteParticipant);


// // --- Rute Pendaftaran Renang dan buku acara (MEMERLUKAN LOGIN & OTORISASI) ---
router.post('/login', user.loginUser);
router.post('/createEvent', verifyToken, authorizeRoles(['admin']), event.createEvent);

router.post('/categories/getAvailableRaces', raceCategories.getAvailableRaces);
router.post('/registrations', verifyToken, authorizeRoles(['member']), participant.registerSwimmer);
router.post('/uploadPayment', verifyToken, authorizeRoles(['member']), participant.uploadPayment);
router.put('/updatePaymentStatusAdmin', participant.updatePaymentStatusAdmin);
router.get('/getStartList/:event_id',  event.getStartList);
router.post('/generateEventBookPdf', verifyToken, authorizeRoles(['member','admin']), event.generateEventBookPdf);
router.post('/generateEventBookExcel', verifyToken, authorizeRoles(['member','admin']), event.generateEventBookExcel);

// router.get("/startlist/pdf/:event_id",verifyToken, authorizeRoles(['member']), event.generateEventBookPdf);


// router.get("getBukuAcara/:eventId", participant.getBukuAcara);


router.get('/getStatusPaymentById/:id', participant.getStatusPaymentById);
router.get('/getAllPayment', participant.getAllPayment);

// router.post('/uploadPaymentProof',participant.uploadPaymentProof);

// Rute untuk mengedit status pembayaran (admin)
// Anda mungkin ingin menambahkan middleware otentikasi admin di sini


// Tetapkan Detail Seri / Heat
// Siapa yang melakukan: Admin
// Kapan: Setelah race_categories didefinisikan dan pendaftaran ditutup (atau saat administrasi lomba dilakukan). Ini adalah langkah di mana admin menentukan berapa banyak seri (heat) dan grup yang akan ada untuk setiap nomor lomba.
// Tujuan: Mengatur struktur grid jadwal lomba.
// Data yang dimasukkan: race_category_id (FK ke race_categories), heat_number (seri), group_letter (grup).
// Tabel yang diisi: heat_details
router.post('/createHeatDetail', verifyToken, authorizeRoles(['admin']), heatDetails.createHeatDetail);
router.post('/getHeatDetailById', verifyToken, authorizeRoles(['admin']), heatDetails.getHeatDetailById);
router.post('/getAllHeatDetailsByRaceCategoryId', verifyToken, authorizeRoles(['admin']), heatDetails.getAllHeatDetailsByRaceCategoryId);
router.post('/updateHeatDetail', verifyToken, authorizeRoles(['admin']), heatDetails.updateHeatDetail);
router.post('/deleteHeatDetail', verifyToken, authorizeRoles(['admin']), heatDetails.deleteHeatDetail);



// Tugaskan Peserta ke Seri / Lintasan (Langkah Kritis untuk Buku Acara)
// Siapa yang melakukan: Admin (secara manual atau melalui fitur otomatisasi di sistem)
// Kapan: Setelah pendaftaran ditutup, semua swimmer_registrations diverifikasi, dan heat_details telah dibuat.
// Tujuan: Menempatkan peserta yang sudah terdaftar (swimmer_registrations) ke dalam jadwal lomba yang spesifik (seri dan lintasan). Inilah yang menjadi data detailSwimmer di buku acara.
// Data yang dimasukkan: heat_detail_id (FK ke heat_details), lane_number (lint), swimmer_name (diambil dari swimmer_registrations.full_name), club_name (diambil dari swimmer_registrations.club_name), qet_time, result_time. Anda juga bisa menambahkan registration_id (FK ke swimmer_registrations) di sini untuk referensi.
// Tabel yang diisi: heat_swimmers
// Contoh Aksi: Admin melihat AISYAH AYUDIA ALIFA telah mendaftar. Admin menugaskannya ke heat_detail_id untuk "Seri 1 Grup a", Lintasan 1, dengan nama dan klubnya.
// API/Fungsi Terkait: Anda perlu API CRUD baru untuk heat_swimmers.
router.get('/getAllHeatDetails', verifyToken, authorizeRoles(['admin']), heatSwimmer.getAllHeatSwimmers);
router.post('/createHeatSwimmer', verifyToken, authorizeRoles(['admin']), heatSwimmer.createHeatSwimmer);
router.get('/getAllHeatSwimmersByHeatDetailId/:id', verifyToken, authorizeRoles(['admin']),  heatSwimmer.getAllHeatSwimmersByHeatDetailId);
router.get('/getHeatSwimmerById/:id', verifyToken, authorizeRoles(['admin']), heatSwimmer.getHeatSwimmerById);
router.put('/updateHeatSwimmer/:id', verifyToken, authorizeRoles(['admin']), heatSwimmer.updateHeatSwimmer);
router.delete('/deleteHeatSwimmer/:id', verifyToken, authorizeRoles(['admin']), heatSwimmer.deleteHeatSwimmer);


// Ambil Data Buku Acara
// Siapa yang melakukan: Frontend / Aplikasi (saat peserta ingin melihat buku acara)
// Kapan: Biasanya H-1 atau pada hari H acara.
// Tujuan: Menyusun semua data dari tabel events, race_categories, heat_details, dan heat_swimmers menjadi format JSON yang mudah dibaca.
// Tabel yang diakses: events, race_categories, heat_details, heat_swimmers.
// Contoh Aksi: Aplikasi frontend memanggil API untuk mendapatkan buku acara event_id tertentu.
// API/Fungsi Terkait: getEventBook (GET /oceantic/v1/events/:eventId/book) yang memanggil stored procedure GetEventBookData.
// router.post('/getEventBook', event.getEventBook);

// Contoh Aksi: Untuk race_category_id dari "Acara 120, 25M, Papan Bebas, Golongan D, Putri", Admin membuat "Seri 1 Grup a" dan "Seri 1 Grup b" di tabel heat_details.
// router.get('/registrations/:id', verifyToken, authorizeRoles(['admin', 'member']), getRegistrationById);
// router.put('/registrations/:id', verifyToken, authorizeRoles(['admin']), updateRegistration);
// router.delete('/registrations/:id', verifyToken, authorizeRoles(['admin']), deleteArticle); // Perbaikan: deleteArticle
// router.get('/registrations/user/:userId', verifyToken, authorizeRoles(['admin']), getRegistrationsByUserId);
// router.get('/registrations/event/:eventId', verifyToken, authorizeRoles(['admin']), getRegistrationsByEventId);

// --- Rute Artikel ---
// POST /oceantic/v1/articles
router.post('/articles/createArticle', verifyToken, authorizeRoles(['admin']), article.createArticle);
// GET /oceantic/v1/articles/category/:categoryName
router.get('/articles/getArticlesByCategory', article.getArticlesByCategory);
// File: router.js (atau mainApiRouter.js)



router.get('/articles/getAllArticles', article.getAllArticles);
// GET /oceantic/v1/articles/:id
router.get('/articles/getArticleById/:id', article.getArticleById);
// PUT /oceantic/v1/articles/:id
router.put('/articles/updateArticle/:id', verifyToken, authorizeRoles(['admin']), article.updateArticle);
// DELETE /oceantic/v1/articles/:id
router.delete('/articles/deleteArticle/:id', verifyToken, authorizeRoles(['admin']), article.deleteArticle);


// --- Rute Event ---
router.get('/events/getAllEvents', event.getAllEvents);
router.get('/events/getEventsById/:id', event.getEventById);

router.get('/events/getAllEventsOpen', event.getAllEventsOpen); // Menggunakan fungsi getAllEventsOpen yang spesifik\
router.put('/events/edit/:id', verifyToken, authorizeRoles(['admin']), event.updateEvent);
router.delete('/events/:id', verifyToken, authorizeRoles(['admin']), event.deleteEvent);


// --- Rute Kategori ---
// POST /oceantic/v1/categories
router.post('/categories', verifyToken, authorizeRoles(['admin']), category.createCategory);

// GET /oceantic/v1/categories/getCategoryEventByEventId/:id
router.get('/categories/getCategoryEventByEventId/:id', category.getCategoriesByEventId);
// GET /oceantic/v1/categories/by-umur (jika Anda ingin menggunakan ini)
router.post('/categories/getCategoryEventByName', category.getCategoryEventByName); // Menggunakan nama yang diperbarui
// PUT /oceantic/v1/categories/:id
router.put('/categories/:id', verifyToken, authorizeRoles(['admin']), category.updateCategory);
// DELETE /oceantic/v1/categories/:id
router.delete('/categories/:id', verifyToken, authorizeRoles(['admin']), category.deleteCategory);
router.post('/createRaceCategory', verifyToken, authorizeRoles(['admin']), raceCategories.createRaceCategory);
router.get('/getRaceCategoryById/:id', verifyToken, authorizeRoles(['admin']), raceCategories.getRaceCategoryById);
router.get('/getAllRaceCategoriesByEventId/:id', verifyToken, authorizeRoles(['admin']), raceCategories.getAllRaceCategoriesByEventId);
router.put('/updateRaceCategory/:id', verifyToken, authorizeRoles(['admin']), raceCategories.updateRaceCategory);
router.delete('/deleteRaceCategory/:id', verifyToken, authorizeRoles(['admin']), raceCategories.deleteRaceCategory);







// ====================================

// percobaan buku acara




// ====================================






// Contoh Rute yang Dilindungi (opsional)
router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'Anda berhasil mengakses rute yang dilindungi di /oceantic/v1/protected!',
    user: req.user
  });
});

module.exports = router;
