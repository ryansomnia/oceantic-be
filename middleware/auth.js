// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Memuat variabel lingkungan

const verifyToken = (req, res, next) => {
  // Ambil token dari header Authorization (Bearer Token)
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ message: 'Token tidak disediakan.' });
  }

  const token = authHeader.split(' ')[1]; // Ambil bagian token setelah 'Bearer '

  if (!token) {
    return res.status(403).json({ message: 'Format token tidak valid atau token tidak ada.' });
  }

  // Verifikasi token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // Token tidak valid atau kadaluarsa
      return res.status(401).json({ message: 'Token tidak valid atau kadaluarsa.' });
    }
    // Jika token valid, simpan informasi user yang di-decode ke objek request
    req.user = decoded;
    next(); // Lanjutkan ke rute berikutnya
  });
};

module.exports = verifyToken;
