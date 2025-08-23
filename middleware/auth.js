// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Memuat variabel lingkungan dari file .env

// Fungsi authorizeRoles yang diperbarui agar lebih fleksibel
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    // Pastikan objek pengguna ada setelah middleware verifyToken
    if (!req.user) {
      return res.status(403).json({ 
        code: 403,
        message: 'Akses ditolak: Informasi pengguna tidak ditemukan di token.' 
      });
    }

    let userHasPermission = false;
    
    // Opsi 1: Cek jika peran disimpan sebagai array (mis. { roles: ['admin', 'member'] })
    if (req.user.roles && Array.isArray(req.user.roles)) {
      userHasPermission = req.user.roles.some(role => allowedRoles.includes(role));
    } 
    // Opsi 2: Cek jika peran disimpan sebagai string tunggal (mis. { role: 'member' })
    else if (req.user.role && typeof req.user.role === 'string') {
      userHasPermission = allowedRoles.includes(req.user.role);
    }
    
    if (!userHasPermission) {
      return res.status(403).json({ 
        code: 403,
        message: 'Akses ditolak: Anda tidak memiliki izin untuk melakukan aksi ini.' 
      });
    }

    next();
  };
};

// Fungsi verifyToken untuk memverifikasi token dan menambahkan informasi pengguna ke req
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ 
      code: 403,
      message: "Forbidden",
      detail: 'Token tidak disediakan.' 
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(403).json({ 
      code: 403,
      message: "Forbidden",
      detail: 'Format token tidak valid atau token tidak ada.' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        code: 401,
        message: "Unauthorized",
        detail: 'Token tidak valid atau kadaluarsa. Silahkan login kembali' 
      });
    }
    // Penting: Pastikan payload JWT Anda berisi properti 'role'
    req.user = decoded;
    next();
  });
};

module.exports = { verifyToken, authorizeRoles };
