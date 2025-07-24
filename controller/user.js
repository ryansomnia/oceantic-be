// controller/user.js
const bcrypt = require('bcryptjs'); // Untuk hashing password
const jwt = require('jsonwebtoken'); // Untuk membuat JWT
const pool = require('../config/db'); // Import pool koneksi database
require('dotenv').config(); // Memuat variabel lingkungan

// Fungsi untuk Registrasi Pengguna
const registerUser = async (req, res) => {
  const { username, password, fullname, email, nohp, gender, role } = req.body;

  // Validasi input sederhana
  if (!username || !password || !fullname || !email || !nohp || !gender) {
    return res.status(400).json({ message: 'Semua kolom wajib diisi.' });
  }

  try {
    // Cek apakah username atau email sudah ada
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username atau Email sudah terdaftar.' });
    }

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds = 10

    // Simpan pengguna baru ke database
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, fullname, email, nohp, gender, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, fullname, email, nohp, gender, role || 'peserta'] // Default role jika tidak disediakan
    );

    res.status(201).json({ message: 'Registrasi berhasil!', userId: result.insertId });
  } catch (error) {
    console.error('Error saat registrasi:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat registrasi.' });
  }
};

// Fungsi untuk Login Pengguna
const loginUser = async (req, res) => {
  console.log('================login====================');
  console.log("login");
  console.log('====================================');
  const { username, password } = req.body;

  // Validasi input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username/Email dan Password wajib diisi.' });
  }

  try {
    // Cari pengguna berdasarkan username atau email
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username] // Mencari di kedua kolom
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Username/Email atau Password salah.' });
    }

    const user = users[0];

    // Bandingkan password yang dimasukkan dengan password yang di-hash di database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Username/Email atau Password salah.' });
    }

    // Buat JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullname: user.fullname },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token akan kadaluarsa dalam 1 jam
    );
    console.log('==================user==================');
    console.log(user);
    console.log('====================================');

    // Kirim token dan informasi user (tanpa password)
    res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        nohp: user.nohp,
        gender: user.gender,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error saat login:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
};
// Fungsi untuk mendapatkan profil pengguna yang sedang login
const getUserProfile = async (req, res) => {
  // ID pengguna didapat dari token JWT setelah middleware verifyToken
  const userId = req.body.id;
console.log('=================sss===================');
console.log(userId);
console.log('====================================');
  try {
      const [rows] = await pool.execute(
          'SELECT id, username, fullname, email, nohp, gender, role FROM users WHERE id = ?',
          [userId]
      );
      if (rows.length === 0) {
          return res.status(404).json({ message: 'User not found.' });
      }
      console.log('====================================');
      console.log(rows);
      console.log('====================================');
      res.status(200).json(rows[0]);
  } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};
const updateUserProfile = async (req, res) => {
  const userId = req.user.id; // ID dari token
  const { fullname, email, nohp, gender } = req.body;

  // Validasi sederhana
  if (!fullname && !email && !nohp && !gender) {
      return res.status(400).json({ message: 'Tidak ada data yang disediakan untuk diperbarui.' });
  }

  // Bangun query UPDATE secara dinamis
  const fields = [];
  const values = [];

  if (fullname !== undefined) { fields.push('fullname = ?'); values.push(fullname); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (nohp !== undefined) { fields.push('nohp = ?'); values.push(nohp); }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }

  if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada data valid untuk diperbarui.' });
  }

  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
  values.push(userId);

  try {
      const [result] = await pool.execute(query, values);

      if (result.affectedRows === 0) {
          // Ini bisa terjadi jika user tidak ditemukan (meskipun sudah diverifikasi token)
          // atau jika tidak ada perubahan data yang sebenarnya
          return res.status(404).json({ message: 'Pengguna tidak ditemukan atau tidak ada perubahan.' });
      }

      // Ambil data user yang diperbarui untuk dikirim kembali ke frontend
      const [updatedUser] = await pool.execute(
          'SELECT id, username, fullname, email, nohp, gender, role FROM users WHERE id = ?',
          [userId]
      );

      res.status(200).json({ message: 'Profil berhasil diperbarui.', user: updatedUser[0] });
  } catch (error) {
      console.error('Error updating user profile:', error);
      // Periksa jika error karena duplikat email
      if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: 'Email sudah digunakan oleh pengguna lain.' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui profil.' });
  }
};

module.exports = {

  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile
};
