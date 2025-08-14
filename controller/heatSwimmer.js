const pool = require('../config/db'); // Import pool koneksi database secara langsung
// const verifyToken = require('../middleware/auth'); // Middleware autentikasi (akan diterapkan di router)
// const authorizeRoles = require('../middleware/auth').authorizeRoles; // Middleware otorisasi (akan diterapkan di router)

// 1. Fungsi untuk Menambahkan Perenang ke Heat (Seri/Lintasan)
let heatSwimmer = {
  getAllHeatSwimmers: async (req, res) => {
    try {
      // Urutkan berdasarkan lane_number untuk tampilan yang lebih baik
      const [rows] = await pool.execute('SELECT * FROM heat_swimmers');
      res.status(200).json({ code: 200, message: 'Daftar perenang di heat berhasil diambil.', detail: rows });
    } catch (error) {
      console.error('Error in getAllHeatSwimmersByHeatDetailId controller:', error);
      res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan daftar perenang di heat.', detail: error.message });
    }
  },
 createHeatSwimmer : async (req, res) => {
  const { heat_detail_id, lane_number, swimmer_name, club_name, qet_time, result_time, registration_id } = req.body;

  // Validasi input awal
  if (!heat_detail_id || !lane_number || !swimmer_name) {
    return res.status(400).json({ code: 400, message: 'ID Heat Detail, Nomor Lintasan, dan Nama Perenang wajib diisi.', detail: null });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO heat_swimmers (heat_detail_id, lane_number, swimmer_name, club_name, qet_time, result_time, registration_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [heat_detail_id, lane_number, swimmer_name, club_name || null, qet_time || null, result_time || '', registration_id || null]
    );

    res.status(201).json({ code: 201, message: 'Perenang berhasil ditambahkan ke heat!', detail: { id: result.insertId } });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Perenang di lintasan ini sudah ada untuk heat detail yang sama.', detail: null });
    }
    console.error('Error in createHeatSwimmer controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat menambahkan perenang ke heat.', detail: error.message });
  }
},

// 2. Fungsi untuk Mendapatkan Detail Perenang di Heat berdasarkan ID
 getHeatSwimmerById : async (req, res) => {
  const {id}  = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM heat_swimmers WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: 'Detail perenang di heat tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Detail perenang di heat ditemukan.', detail: rows[0] });
  } catch (error) {
    console.error('Error in getHeatSwimmerById controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan detail perenang di heat.', detail: error.message });
  }
},

// 3. Fungsi untuk Mendapatkan Semua Perenang di Heat Detail Tertentu
 getAllHeatSwimmersByHeatDetailId : async (req, res) => {
  const  {id} = req.params; // Asumsi heatDetailId diambil dari URL parameter
  try {
    // Urutkan berdasarkan lane_number untuk tampilan yang lebih baik
    const [rows] = await pool.execute('SELECT * FROM heat_swimmers WHERE heat_detail_id = ? ORDER BY lane_number ASC', [id]);
    res.status(200).json({ code: 200, message: 'Daftar perenang di heat berhasil diambil.', detail: rows });
  } catch (error) {
    console.error('Error in getAllHeatSwimmersByHeatDetailId controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan daftar perenang di heat.', detail: error.message });
  }
},

// 4. Fungsi untuk Memperbarui Detail Perenang di Heat
 updateHeatSwimmer : async (req, res) => {
const {id} =req.params;
  const updateData = req.body;

  const { lane_number, swimmer_name, club_name, qet_time, result_time, registration_id } = updateData;

  const fields = [];
  const values = [];

  if (lane_number !== undefined) { fields.push('lane_number = ?'); values.push(lane_number); }
  if (swimmer_name !== undefined) { fields.push('swimmer_name = ?'); values.push(swimmer_name); }
  if (club_name !== undefined) { fields.push('club_name = ?'); values.push(club_name); }
  if (qet_time !== undefined) { fields.push('qet_time = ?'); values.push(qet_time); }
  if (result_time !== undefined) { fields.push('result_time = ?'); values.push(result_time); }
  if (registration_id !== undefined) { fields.push('registration_id = ?'); values.push(registration_id); }


  if (fields.length === 0) {
    return res.status(400).json({ code: 400, message: 'Tidak ada data yang disediakan untuk diperbarui.', detail: null });
  }

  const query = `UPDATE heat_swimmers SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  try {
    const [result] = await pool.execute(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Detail perenang di heat tidak ditemukan atau tidak ada perubahan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Detail perenang di heat berhasil diperbarui.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Kombinasi lintasan dan heat detail yang diperbarui sudah ada.', detail: null });
    }
    console.error('Error in updateHeatSwimmer controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat memperbarui detail perenang di heat.', detail: error.message });
  }
},

// 5. Fungsi untuk Menghapus Perenang dari Heat
 deleteHeatSwimmer : async (req, res) => {
  const { id } = req.body;
  try {
    const [result] = await pool.execute('DELETE FROM heat_swimmers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Detail perenang di heat tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Perenang berhasil dihapus dari heat.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    console.error('Error in deleteHeatSwimmer controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat menghapus perenang dari heat.', detail: error.message });
  }
}
}



module.exports = heatSwimmer;
