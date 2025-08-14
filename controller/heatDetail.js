const pool = require('../config/db'); // Import pool koneksi database secara langsung

// 1. Fungsi untuk Membuat Heat Detail Baru

let heatDetails = {
    createHeatDetail : async (req, res) => {
  const { race_category_id, heat_number, group_letter } = req.body;

  // Validasi input awal
  if (!race_category_id || !heat_number || !group_letter) {
    return res.status(400).json({ code: 400, message: 'Semua field heat detail wajib diisi.', detail: null });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO heat_details (race_category_id, heat_number, group_letter)
       VALUES (?, ?, ?)`,
      [race_category_id, heat_number, group_letter]
    );

    res.status(201).json({ code: 201, message: 'Heat detail berhasil dibuat!', detail: { id: result.insertId } });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Heat detail dengan kombinasi yang sama sudah ada untuk kategori perlombaan ini.', detail: null });
    }
    console.error('Error in createHeatDetail controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat membuat heat detail.', detail: error.message });
  }
},

// 2. Fungsi untuk Mendapatkan Heat Detail berdasarkan ID
 getHeatDetailById : async (req, res) => {
  const id = req.body.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM heat_details WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: 'Heat detail tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Heat detail ditemukan.', detail: rows[0] });
  } catch (error) {
    console.error('Error in getHeatDetailById controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan heat detail.', detail: error.message });
  }
},

// 3. Fungsi untuk Mendapatkan Semua Heat Detail untuk Race Category Tertentu
 getAllHeatDetailsByRaceCategoryId : async (req, res) => {
  const raceCategoryId = req.body.raceCategoryId; // Asumsi raceCategoryId diambil dari URL parameter
  try {
    const [rows] = await pool.execute('SELECT * FROM heat_details WHERE race_category_id = ?', [raceCategoryId]);
    res.status(200).json({ code: 200, message: 'Daftar heat detail berhasil diambil.', detail: rows });
  } catch (error) {
    console.error('Error in getAllHeatDetailsByRaceCategoryId controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan daftar heat detail.', detail: error.message });
  }
},

// 4. Fungsi untuk Memperbarui Heat Detail
 updateHeatDetail : async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const { heat_number, group_letter } = updateData;

  const fields = [];
  const values = [];

  if (heat_number !== undefined) { fields.push('heat_number = ?'); values.push(heat_number); }
  if (group_letter !== undefined) { fields.push('group_letter = ?'); values.push(group_letter); }

  if (fields.length === 0) {
    return res.status(400).json({ code: 400, message: 'Tidak ada data yang disediakan untuk diperbarui.', detail: null });
  }

  const query = `UPDATE heat_details SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  try {
    const [result] = await pool.execute(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Heat detail tidak ditemukan atau tidak ada perubahan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Heat detail berhasil diperbarui.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Kombinasi heat detail yang diperbarui sudah ada.', detail: null });
    }
    console.error('Error in updateHeatDetail controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat memperbarui heat detail.', detail: error.message });
  }
},

// 5. Fungsi untuk Menghapus Heat Detail
 deleteHeatDetail : async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM heat_details WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Heat detail tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Heat detail berhasil dihapus.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    console.error('Error in deleteHeatDetail controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat menghapus heat detail.', detail: error.message });
  }
}
}

module.exports = heatDetails;
