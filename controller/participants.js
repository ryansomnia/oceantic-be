// services/registrationService.js
const pool = require('../config/db');
const path = require('path');
const fs = require('fs/promises');


let participants = {
// Fungsi Layanan untuk Mendaftarkan Peserta Baru
 registerSwimmer : async (req, res) => {
  // --- DEBUGGING: Log req.body saat diterima oleh backend ---
  console.log('Request Body di Backend:', req.body);
  // --- AKHIR DEBUGGING ---

  const {
    user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
    club_name, stroke_category, age_category, distance_category, jenis_renang,
    emergency_contact_name, emergency_contact_phone,
    health_info, tshirt_size, payment_status
  } = req.body;

  // Konversi parent_consent dan rules_consent dari string ke boolean/integer
  const parent_consent = req.body.parent_consent === 'true' ? 1 : 0;
  const rules_consent = req.body.rules_consent === 'true' ? 1 : 0;

  // --- Validasi Input ---
  if (!user_id || !event_id || !full_name || !date_of_birth || !gender || !email || !phone_number ||
      !club_name || !stroke_category || !age_category || !distance_category || !jenis_renang ||
      !emergency_contact_name || !emergency_contact_phone) {
    return res.status(400).json({ message: 'Semua field wajib diisi (kecuali health_info, tshirt_size, payment_photo, supporting_document).' });
  }
  if (!parent_consent || !rules_consent) { // Validasi setelah konversi
    return res.status(400).json({ message: 'Anda harus menyetujui persetujuan orang tua/wali dan aturan lomba.' });
  }

  // --- Penanganan File ---
  let paymentPhotoFile = req.files ? req.files.payment_photo : null;
  let supportingDocumentFile = req.files ? req.files.supporting_document : null;

  let paymentPhotoPath = null;
  let supportingDocumentPath = null;

  // Safely get the file object, handling potential arrays from express-fileupload.
  const paymentPhoto = (Array.isArray(paymentPhotoFile) ? paymentPhotoFile[0] : paymentPhotoFile);
  const supportingDocument = (Array.isArray(supportingDocumentFile) ? supportingDocumentFile[0] : supportingDocumentFile);

  // Validasi dan proses paymentPhotoFile
  if (payment_status === 'Paid') {
    if (!paymentPhoto || typeof paymentPhoto.name !== 'string' || paymentPhoto.name.length === 0 || typeof paymentPhoto.mv !== 'function') {
      return res.status(400).json({ message: 'Foto pembayaran wajib diunggah dan valid jika status pembayaran adalah Paid.' });
    }
    const allowedImageTypes = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(paymentPhoto.name).toLowerCase();
    if (!allowedImageTypes.includes(ext)) {
      return res.status(422).json({ message: 'Tipe file foto pembayaran tidak valid. Hanya PNG, JPG, JPEG yang diizinkan.' });
    }
    if (paymentPhoto.size > 5000000) { // 5MB limit
      return res.status(422).json({ message: 'Ukuran foto pembayaran terlalu besar (maks 5MB).' });
    }
  }

  // Validasi dan proses supportingDocumentFile (jika ada)
  if (supportingDocument) {
    if (typeof supportingDocument.name !== 'string' || supportingDocument.name.length === 0 || typeof supportingDocument.mv !== 'function') {
        // Jika file ada tapi tidak valid, bisa diabaikan atau dikembalikan error
        console.warn('Peringatan: supportingDocumentFile diberikan tetapi bukan objek file yang valid.');
        supportingDocument = null; // Set ke null agar tidak diproses
    } else {
        const allowedDocTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(supportingDocument.name).toLowerCase();
        if (!allowedDocTypes.includes(ext)) {
            return res.status(422).json({ message: 'Tipe file dokumen pendukung tidak valid.' });
        }
        if (supportingDocument.size > 10000000) { // 10MB limit (contoh)
            return res.status(422).json({ message: 'Ukuran dokumen pendukung terlalu besar (maks 10MB).' });
        }
    }
  }

  try {
    // Pindahkan file ke direktori publik
    if (paymentPhoto) {
      const uploadDir = path.join(__dirname, '../public/uploads/payments');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${paymentPhoto.name}`;
      paymentPhotoPath = `/uploads/payments/${fileName}`;
      await paymentPhoto.mv(path.join(uploadDir, fileName));
    }

    if (supportingDocument) {
      const uploadDir = path.join(__dirname, '../public/uploads/documents');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${supportingDocument.name}`;
      supportingDocumentPath = `/uploads/documents/${fileName}`;
      await supportingDocument.mv(path.join(uploadDir, fileName));
    }

    // Masukkan data pendaftaran ke database
    const [result] = await pool.execute(
      `INSERT INTO swimmer_registrations (
        user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
        club_name, stroke_category, age_category, distance_category, jenis_renang,
        emergency_contact_name, emergency_contact_phone,
        health_info, tshirt_size, payment_status, payment_photo_url, supporting_document_url,
        parent_consent, rules_consent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
        club_name, stroke_category, age_category, distance_category, jenis_renang,
        emergency_contact_name, emergency_contact_phone,
        health_info, tshirt_size, payment_status, paymentPhotoPath, supportingDocumentPath,
        parent_consent, // <--- Sekarang akan menjadi 1 atau 0
        rules_consent   // <--- Sekarang akan menjadi 1 atau 0
      ]
    );

    res.status(201).json({
      message: 'Pendaftaran berhasil!',
      registrationId: result.insertId,
      paymentPhotoUrl: paymentPhotoPath,
      supportingDocumentUrl: supportingDocumentPath
    });
  } catch (error) {
    console.error('Error saat mendaftarkan peserta:', error);
    // Jika terjadi error, hapus file yang mungkin sudah terupload
    if (paymentPhotoPath) {
      await fs.unlink(path.join(__dirname, '../public', paymentPhotoPath)).catch(err => console.warn('Gagal menghapus file pembayaran:', err.message));
    }
    if (supportingDocumentPath) {
      await fs.unlink(path.join(__dirname, '../public', supportingDocumentPath)).catch(err => console.warn('Gagal menghapus dokumen pendukung:', err.message));
    }
    res.status(500).json({ message: 'Terjadi kesalahan server saat mendaftarkan peserta.' });
  }
},

// Fungsi Layanan untuk Mendapatkan Detail Pendaftaran berdasarkan ID
 getRegistrationById : async (id) => {
  const [rows] = await pool.execute('SELECT * FROM swimmer_registrations WHERE id = ?', [id]);
  return rows[0];
},

// Fungsi Layanan untuk Memperbarui Pendaftaran
 updateRegistration :async (id, updateData, paymentPhotoFileArg, supportingDocumentFileArg) => {
  let paymentPhotoPath = null;
  let supportingDocumentPath = null;
  let oldPaymentPhotoPath = null;
  let oldSupportingDocumentPath = null;

  // Ambil objek file dengan aman.
  const paymentPhoto = (Array.isArray(paymentPhotoFileArg) ? paymentPhotoFileArg[0] : paymentPhotoFileArg);
  const supportingDocument = (Array.isArray(supportingDocumentFileArg) ? supportingDocumentFileArg[0] : supportingDocumentFileArg);

  try {
    // Ambil data pendaftaran lama untuk mendapatkan path file lama
    const [oldRegistrationRows] = await pool.execute('SELECT payment_photo_url, supporting_document_url FROM swimmer_registrations WHERE id = ?', [id]);
    if (oldRegistrationRows.length > 0) {
      oldPaymentPhotoPath = oldRegistrationRows[0].payment_photo_url;
      oldSupportingDocumentPath = oldRegistrationRows[0].supporting_document_url;
    }

    // Tangani upload file bukti pembayaran baru
    if (paymentPhoto && typeof paymentPhoto.name === 'string' && paymentPhoto.name.length > 0 && typeof paymentPhoto.mv === 'function') {
      const uploadDir = path.join(__dirname, '../public/uploads/payments');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${paymentPhoto.name}`;
      paymentPhotoPath = `/uploads/payments/${fileName}`;
      await paymentPhoto.mv(path.join(uploadDir, fileName));

      if (oldPaymentPhotoPath) {
        await fs.unlink(path.join(__dirname, '../public', oldPaymentPhotoPath)).catch(err => console.warn('Gagal menghapus file pembayaran lama:', err.message));
      }
    } else {
      paymentPhotoPath = oldPaymentPhotoPath; // Pertahankan path lama jika tidak ada file baru yang valid
    }

    // Tangani upload file dokumen pendukung baru
    if (supportingDocument && typeof supportingDocument.name === 'string' && supportingDocument.name.length > 0 && typeof supportingDocument.mv === 'function') {
      const uploadDir = path.join(__dirname, '../public/uploads/documents');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${supportingDocument.name}`;
      supportingDocumentPath = `/uploads/documents/${fileName}`;
      await supportingDocument.mv(path.join(uploadDir, fileName));

      if (oldSupportingDocumentPath) {
        await fs.unlink(path.join(__dirname, '../public', oldSupportingDocumentPath)).catch(err => console.warn('Gagal menghapus dokumen pendukung lama:', err.message));
      }
    } else {
      supportingDocumentPath = oldSupportingDocumentPath; // Pertahankan path lama jika tidak ada file baru yang valid
    }


    const fields = [];
    const values = [];

    // Iterasi melalui updateData untuk membangun query dinamis
    for (const key in updateData) {
      // Pastikan hanya field yang relevan dan tidak undefined yang ditambahkan
      // dan tidak termasuk file yang ditangani secara terpisah
      if (updateData[key] !== undefined && key !== 'payment_photo' && key !== 'supporting_document') {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    }

    // Tambahkan path file ke fields/values jika diupdate
    // Penting: Hanya update jika path baru berbeda dari yang lama atau jika path lama perlu di-null-kan
    if (paymentPhotoPath !== oldPaymentPhotoPath) { fields.push('payment_photo_url = ?'); values.push(paymentPhotoPath); }
    if (supportingDocumentPath !== oldSupportingDocumentPath) { fields.push('supporting_document_url = ?'); values.push(supportingDocumentPath); }

    if (fields.length === 0) {
      return 0; // Tidak ada perubahan
    }

    const query = `UPDATE swimmer_registrations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const [result] = await pool.execute(query, [...values, id]);
    return result.affectedRows;
  } catch (error) {
    throw error;
  }
},

// Fungsi Layanan untuk Mendapatkan Detail Pendaftaran berdasarkan ID
 getRegistrationsByUserId : async (userId) => {
  const [rows] = await pool.execute('SELECT * FROM swimmer_registrations WHERE user_id = ? ORDER BY registration_date DESC', [userId]);
  return rows;
},

// Fungsi Layanan untuk Mendapatkan Pendaftaran berdasarkan Event ID
 getRegistrationsByEventId : async (eventId) => {
  const [rows] = await pool.execute('SELECT * FROM swimmer_registrations WHERE event_id = ? ORDER BY registration_date DESC', [eventId]);
  return rows;
}

}
module.exports = participants;