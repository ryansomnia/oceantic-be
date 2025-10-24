// controller/user.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Fungsi untuk Registrasi Pengguna
let user = {
 
 registerUser : async (req, res) => {
  const { username, password, fullname, email, nohp, gender, role } = req.body;

  if (!username || !password || !fullname || !email || !nohp || !gender) {
    return res.status(400).json({ message: 'Semua kolom wajib diisi.' });
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username atau Email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, fullname, email, nohp, gender, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, fullname, email, nohp, gender, role || 'member']
    );

    res.status(201).json({ message: 'Registrasi berhasil!', id: result.insertId });
  } catch (error) {
    console.error('Error saat registrasi:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat registrasi.' });
  }
},



// Fungsi untuk Login Pengguna
 loginUser : async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username/Email dan Password wajib diisi.' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Username/Email atau Password salah.' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Username/Email atau Password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullname: user.fullname },
      process.env.JWT_SECRET,
      { expiresIn: '5h' }
    );

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
},

// Fungsi untuk mendapatkan profil pengguna yang sedang login
 getUserProfile : async (req, res) => {
  const userId = req.body.id;

  try {
      const [rows] = await pool.execute(
          'SELECT id, username, fullname, email, nohp, gender,  role FROM users WHERE id = ?',
          [userId]
      );
      if (rows.length === 0) {
          return res.status(404).json({ message: 'User not found.' });
      }
      res.status(200).json(rows[0]);
  } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

//  updateUserProfile : async (req, res) => {
//   const {id} = req.params;
//   const { username, fullname, email, nohp, role } = req.body;

//   if (!username && !fullname && !email && !nohp && !role) {
//       return res.status(400).json({code:400, message: 'success', detail:'Tidak ada data yang disediakan untuk diperbarui.' });
//   }

//   const fields = [];
//   const values = [];

//   if (username !== undefined) { fields.push('username  = ?'); values.push(username ); }
//   if (fullname !== undefined) { fields.push('fullname  = ?'); values.push(fullname ); }
//   if (email !== undefined) { fields.push('email = ?'); values.push(email); }
//   if (nohp !== undefined) { fields.push('nohp = ?'); values.push(nohp); }
//   if (role !== undefined) { fields.push('role = ?'); values.push(role); }

//   if (fields.length === 0) {
//       return res.status(400).json({code:400, message: 'failed', detail:'Tidak ada data valid untuk diperbarui.' });
//   }

//   const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
//   values.push(id);

//   try {
//       const [result] = await pool.execute(query, values);

//       if (result.affectedRows === 0) {
//           return res.status(404).json({code:404, message: 'failed', detail:'Pengguna tidak ditemukan atau tidak ada perubahan.' });
//       }

//       const [updatedUser] = await pool.execute(
//           'SELECT id, username, fullname, email, nohp, role FROM users WHERE id = ?',
//           [id]
//       );

//       res.status(200).json({code:200, message: 'success', detail:'Profil berhasil diperbarui.', user: updatedUser[0] });
//   } catch (error) {
//       console.error('Error updating user profile:', error);
//       if (error.code === 'ER_DUP_ENTRY') {
//           return res.status(409).json({code:409, message: 'failed', detail:'Email sudah digunakan oleh pengguna lain.' });
//       }
//       res.status(500).json({code:500, message: 'error', detail:'Terjadi kesalahan server saat memperbarui profil.' });
//   }
// },
// Fungsi untuk Update Profil Pengguna (termasuk password)
updateUserProfile: async (req, res) => {
  const { id, fullname, email, nohp, role, oldPassword, newPassword } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'ID user wajib diisi.' });
  }

  try {
    // Ambil user berdasarkan ID
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const user = users[0];
    let updatedPassword = user.password; // default: password lama

    // Jika ingin ganti password
    if (oldPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Password lama salah.' });
      }
      updatedPassword = await bcrypt.hash(newPassword, 10);
    }

    // Update data profil
    await pool.execute(
      `UPDATE users 
       SET fullname = ?, email = ?, nohp = ?,  role = ?, password = ? 
       WHERE id = ?`,
      [fullname || user.fullname, email || user.email, nohp || user.nohp,  role || user.role, updatedPassword, id]
    );

    res.status(200).json({ message: 'Profil berhasil diperbarui.' });
  } catch (error) {
    console.error('Error saat update profil:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat update profil.' });
  }
},


 getAllUsers : async (req, res) => {
  try {


    // Mengambil semua data pengguna kecuali password
    const [users] = await pool.execute(
      'SELECT id, username, fullname, email, nohp, gender, role, created_at FROM users'
    );

    res.status(200).json({code: 200, message: 'success', data: users} );
    return
  } catch (error) {
    console.error('Error saat mengambil semua pengguna:', error);
    res.status(500).json({code: 200, message: 'Terjadi kesalahan server saat mengambil data pengguna.', detail: error} );
return
  }
},

getUserById: async (req, res) => {
  const { id } = req.params;
  console.log('====================================');
  console.log(id);
  console.log('====================================');

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, fullname, email, nohp, role FROM users WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: 'failed',
        detail: 'User tidak ditemukan'
      });
    }

    res.status(200).json({
      code: 200,
      message: 'success',
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      code: 500,
      message: 'error',
      detail: 'Terjadi kesalahan server'
    });
  }
},


 deleteUser : async (req, res) => {
  const { id } = req.params; // Mengambil ID dari URL parameter

  try {
  

    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    // Memeriksa apakah ada baris yang terhapus
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    res.status(200).json({ message: `Pengguna dengan ID ${id} berhasil dihapus.` });
  } catch (error) {
    console.error('Error saat menghapus pengguna:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat menghapus pengguna.' });
  }
},
}
// =========================================================================

module.exports = user;