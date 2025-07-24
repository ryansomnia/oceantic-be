// db.js
const mysql = require('mysql2/promise'); // Menggunakan promise API untuk async/await
require('dotenv').config(); // Memuat variabel lingkungan dari .env

// Konfigurasi koneksi database dari variabel lingkungan
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Batas jumlah koneksi dalam pool
  queueLimit: 0
});

// Fungsi untuk menguji koneksi database
const testDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Terhubung ke database MySQL!');
    connection.release(); // Lepaskan koneksi setelah pengujian
    return true;
  } catch (err) {
    console.error('Gagal terhubung ke database MySQL:', err.message);
    return false;
  }
};

// Panggil fungsi testDbConnection saat file ini dimuat (opsional, sudah ada di server.js)
// testDbConnection();

module.exports = pool; // Ekspor pool koneksi
module.exports.testDbConnection = testDbConnection; // Ekspor fungsi testDbConnection juga
