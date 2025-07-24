// server.js
const express = require('express');
const cors = require('cors'); // Import CORS middleware
const morgan = require('morgan'); // Import morgan untuk logging request
const FileUpload = require('express-fileupload'); // Untuk penanganan upload file
const mainApiRouter = require('./routes/route'); // Import router API utama (routes/index.js)
const { testDbConnection } = require('./config/db'); // Import fungsi testDbConnection dari db.js
require('dotenv').config(); // Memuat variabel lingkungan dari file .env

const app = express();

// Middleware Global
// Mengaktifkan CORS (Cross-Origin Resource Sharing)
// Di produksi, Anda sebaiknya membatasi origin ke domain frontend Anda saja.
app.use(cors());

// Middleware untuk logging request HTTP
app.use(morgan('dev'));

// Middleware untuk parsing JSON body dari request
app.use(express.json());

// Middleware untuk parsing URL-encoded body dari request (jika ada form HTML biasa)
app.use(express.urlencoded({ extended: true })); // Menggantikan body-parser.urlencoded

app.use(FileUpload());

// Middleware untuk menyajikan file statis dari folder 'public'
app.use(express.static('public')); // Menggantikan app.use('/css', express.static(__dirname + 'public/css'))

// Rute Utama API dengan Prefix /oceantic/v1
// Semua rute yang didefinisikan di routes/index.js sekarang akan diawali dengan /oceantic/v1
// Contoh: POST /oceantic/v1/register, GET /oceantic/v1/registrations/:id
app.use('/oceantic/v1', mainApiRouter);

// Rute Home (Root API)
// Ini adalah rute default ketika mengakses base URL API Anda.
app.get('/', (req, res) => {
  res.send('OCEANETIC Backend API berjalan! Akses API di /oceantic/v1/...');
});

// Middleware penanganan 404 (URL tidak ditemukan)
app.use(function (req, res, next) {
    let ress = {
        code: '404',
        message: "Failed, URL tidak ditemukan",
    }
    res.status(404).send(ress);
});

// Penanganan Error (Middleware terakhir)
// Ini akan menangkap error yang tidak tertangani oleh rute atau middleware sebelumnya.
app.use((err, req, res, next) => {
  console.error(err.stack); // Log error stack ke console server
  res.status(500).send('Terjadi kesalahan pada server!');
});

// Penting: Jangan panggil app.listen() di sini jika Anda mendeploy ke Vercel!
// Vercel akan menangani listening secara internal untuk serverless functions.
// Baris ini hanya untuk pengembangan lokal.
const PORT = process.env.PORT || 5000; // Port default 5000 jika tidak diatur di environment
app.listen(PORT, async () => { // Tandai callback sebagai async
  console.log(`Server berjalan di http://localhost:${PORT}`);

  // Panggil fungsi testDbConnection saat server mulai mendengarkan
  // dan tunggu hasilnya.
  const isConnected = await testDbConnection();
  if (!isConnected) {
    console.error('Koneksi database gagal saat startup. Aplikasi mungkin tidak berfungsi dengan baik.');
    // Opsional: Anda bisa memilih untuk menghentikan aplikasi di sini jika koneksi DB sangat krusial
    // process.exit(1);
  }
});

// Ekspor instance aplikasi Express untuk digunakan oleh Vercel
// Ini adalah titik masuk yang akan dicari oleh Vercel saat deployment.
module.exports = app;