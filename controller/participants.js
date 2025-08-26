// services/registrationService.js
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
require('dotenv').config(); // Memuat variabel lingkungan dari .env

const moment = require('moment');
function getFullTime() {
  let asiaTimeStart = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
  });
  console.log(asiaTimeStart);
  let time = moment(asiaTimeStart, "MM/DD/YYYY").format("YYYY-MM-DD hh:mm:ss");
  console.log(time);
  return time;
}

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


let participants = {
  getAllParticipants : async (req, res) => {
 
    try {
      const [rows] = await pool.execute('SELECT * FROM swimmer_registrations'); // Perhatikan nama kolom 'eventId'
      res.status(200).json({ code: 200, message: 'success', data: rows });
  
      // res.status(200).json(rows);
    } catch (error) {
      console.error('Error saat mendapatkan swimmer_registrations ', error);
      res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
  },
  registerSwimmer: async (req, res) => {
    console.log("Request Body di Backend:", req.body);
  
    const {
      user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
      club_name, 
      emergency_contact_name, emergency_contact_phone,
      selected_races // <-- array of race_category_id
    } = req.body;
  
    // Konversi consent ke boolean/integer
    const parent_consent = req.body.parent_consent === "true" ? 1 : 0;
    const rules_consent = req.body.rules_consent === "true" ? 1 : 0;
  
    // Validasi input utama
    if (!user_id || !event_id || !full_name || !date_of_birth || !gender || !email || !phone_number ||
        !club_name || !emergency_contact_name || !emergency_contact_phone) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "Semua field wajib diisi (kecuali payment_photo)."
      });
    }
    if (!parent_consent || !rules_consent) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "Anda harus menyetujui persetujuan orang tua/wali dan aturan lomba."
      });
    }
  
    // --- File Upload (Supporting Document wajib) ---
    let supportingDocumentFile = req.files ? req.files.supporting_document : null;
    if (!supportingDocumentFile) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "Dokumen pendukung (akta lahir/kartu pelajar) wajib diunggah."
      });
    }
  
    let supportingDocumentPath = null;
    const supportingDocument = Array.isArray(supportingDocumentFile) ? supportingDocumentFile[0] : supportingDocumentFile;
  
    if (typeof supportingDocument.mv !== "function") {
      return res.status(400).json({ message: "File dokumen pendukung tidak valid." });
    }
  
    const allowedDocTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(supportingDocument.name).toLowerCase();
    if (!allowedDocTypes.includes(ext)) {
      return res.status(422).json({ message: "Tipe file dokumen pendukung tidak valid." });
    }
    if (supportingDocument.size > 10000000) {
      return res.status(422).json({ message: "Ukuran dokumen pendukung terlalu besar (maks 10MB)." });
    }
  
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
console.log("sssss");


      const [checkExisting] = await conn.query(
        `SELECT id FROM swimmer_registrations WHERE user_id = ? AND event_id = ?`,
        [user_id, event_id]
      );
    
      if (checkExisting.length > 0) {
        await conn.rollback();
        return res.status(400).json({
          code: 400,
          message: "Bad Request",
          detail: "Anda sudah terdaftar pada event ini."
        });
      }
    
  console.log("asjdnasdnas");
  
      // Simpan file supporting doc
      const uploadDir = path.join(__dirname, "../public/uploads/documents");
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${supportingDocument.name}`;
      supportingDocumentPath = `/uploads/documents/${fileName}`;
      await supportingDocument.mv(path.join(uploadDir, fileName));
  
      // Insert ke swimmer_registrations
      const [regResult] = await conn.query(
        `INSERT INTO swimmer_registrations 
  (user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
   club_name, emergency_contact_name, emergency_contact_phone,
   payment_status, supporting_document_url,
   parent_consent, rules_consent)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
        [
          user_id, event_id, full_name, date_of_birth, gender, email, phone_number,
          club_name,
          emergency_contact_name, emergency_contact_phone,
          "Pending", // default, belum bayar
          supportingDocumentPath,
          parent_consent, rules_consent
        ]
      );
  
      const registrationId = regResult.insertId;
  
      // Insert gaya yang dipilih ke swimmer_events
      if (selected_races && Array.isArray(selected_races)) {
        for (const raceId of selected_races) {
          await conn.query(
            `INSERT INTO swimmer_events (registration_id, race_category_id) VALUES (?, ?)`,
            [registrationId, raceId]
          );
        }
  
        // Hitung biaya sesuai rule
        const [rows] = await conn.query(
          `SELECT COUNT(*) as jumlah_gaya FROM swimmer_events WHERE registration_id = ?`,
          [registrationId]
        );
        const jumlah_gaya = rows[0].jumlah_gaya;
  
        let total_fee = 0;
        if (jumlah_gaya >= 2) {
          total_fee = 250000 + (jumlah_gaya - 2) * 100000;
        }
  
        await conn.query(
          `UPDATE swimmer_registrations SET total_fee = ? WHERE id = ?`,
          [total_fee, registrationId]
        );
  
        await conn.commit();
  
        return res.status(201).json({
          message: "Registrasi berhasil!",
          registrationId,
          total_fee,
          supportingDocumentUrl: supportingDocumentPath
        });
      } else {
        await conn.rollback();
        return res.status(400).json({ message: " wajib diisi minimal 2 gaya." });
      }
  
    } catch (error) {
      await conn.rollback();
      console.error("Error saat mendaftarkan peserta:", error);
  
      if (supportingDocumentPath) {
        await fs.unlink(path.join(__dirname, "../public", supportingDocumentPath)).catch(() => {});
      }
  
      res.status(500).json({ message: "Terjadi kesalahan server saat mendaftarkan peserta." });
    } finally {
      conn.release();
    }
  },

  // [API BARU] Edit data registrasi
editRegistration: async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      code: 400,
      message: "Bad Request",
      detail: "ID registrasi wajib disertakan."
    });
  }

  try {
    const updateData = req.body; // field non-file (full_name, email, dsb)

    // Ambil file baru (jika ada)
    const paymentPhotoFile = req.files ? req.files.payment_photo : null;
    const supportingDocumentFile = req.files ? req.files.supporting_document : null;

    const affectedRows = await participants.updateRegistration(id, updateData, paymentPhotoFile, supportingDocumentFile);

    if (affectedRows === 0) {
      return res.status(404).json({ code: 404, message: "Registrasi tidak ditemukan atau tidak ada perubahan." });
    }

    res.status(200).json({
      code: 200,
      message: "Registrasi berhasil diperbarui",
      id,
      updatedFields: Object.keys(updateData)
    });
  } catch (error) {
    console.error("Error saat edit registrasi:", error);
    res.status(500).json({ code: 500, message: "Terjadi kesalahan server saat update registrasi.", detail: error.message });
  }
},

// [API BARU] Delete registrasi
deleteRegistration: async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ code: 400, message: "Bad Request", detail: "ID registrasi wajib disertakan." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Hapus relasi swimmer_events dulu
    await conn.query(`DELETE FROM swimmer_events WHERE registration_id = ?`, [id]);

    // Ambil path file lama biar bisa dihapus
    const [oldData] = await conn.query(
      `SELECT payment_photo_url, supporting_document_url FROM swimmer_registrations WHERE id = ?`,
      [id]
    );

    // Hapus swimmer_registrations
    const [result] = await conn.query(`DELETE FROM swimmer_registrations WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ code: 404, message: "Registrasi tidak ditemukan." });
    }

    // Hapus file lama (jika ada)
    if (oldData.length > 0) {
      if (oldData[0].payment_photo_url) {
        await fs.unlink(path.join(__dirname, "../public", oldData[0].payment_photo_url)).catch(() => {});
      }
      if (oldData[0].supporting_document_url) {
        await fs.unlink(path.join(__dirname, "../public", oldData[0].supporting_document_url)).catch(() => {});
      }
    }

    await conn.commit();

    res.status(200).json({
      code: 200,
      message: "Registrasi berhasil dihapus",
      id
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error saat delete registrasi:", error);
    res.status(500).json({ code: 500, message: "Terjadi kesalahan server saat delete registrasi.", detail: error.message });
  } finally {
    conn.release();
  }
},

  uploadPayment: async (req, res) => {
    console.log("Request Body di Backend (uploadPayment):", req.body);
  
    const { registration_id } = req.body;
  
    if (!registration_id) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "registration_id wajib diisi."
      });
    }
  
    // --- File Upload Handling ---
    let paymentPhotoFile = req.files ? req.files.payment_photo : null;
    if (!paymentPhotoFile) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "Bukti pembayaran (payment_photo) wajib diunggah."
      });
    }
  
    const paymentPhoto = Array.isArray(paymentPhotoFile) ? paymentPhotoFile[0] : paymentPhotoFile;
  
    if (typeof paymentPhoto.mv !== "function") {
      return res.status(400).json({ message: "File foto pembayaran tidak valid." });
    }
  
    const allowedImageTypes = [".png", ".jpg", ".jpeg"];
    const ext = path.extname(paymentPhoto.name).toLowerCase();
    if (!allowedImageTypes.includes(ext)) {
      return res.status(422).json({ message: "Tipe file foto pembayaran tidak valid." });
    }
    if (paymentPhoto.size > 5000000) {
      return res.status(422).json({ message: "Ukuran foto pembayaran terlalu besar (maks 5MB)." });
    }
  
    let paymentPhotoPath = null;
  
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
  
      // Simpan file bukti pembayaran
      const uploadDir = path.join(__dirname, "../public/uploads/payments");
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${paymentPhoto.name}`;
      paymentPhotoPath = `/uploads/payments/${fileName}`;
      await paymentPhoto.mv(path.join(uploadDir, fileName));
  
      // Update swimmer_registrations
      const [updateResult] = await conn.query(
        `UPDATE swimmer_registrations 
         SET payment_status = ?, payment_photo_url = ?
         WHERE id = ?`,
        ["Paid", paymentPhotoPath, registration_id]
      );
  
      if (updateResult.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ message: "Registrasi tidak ditemukan." });
      }
  
      await conn.commit();
  
      res.status(200).json({
        message: "Upload pembayaran berhasil!",
        registration_id,
        paymentPhotoUrl: paymentPhotoPath
      });
    } catch (error) {
      await conn.rollback();
      console.error("Error saat upload pembayaran:", error);
  
      if (paymentPhotoPath) {
        await fs.unlink(path.join(__dirname, "../public", paymentPhotoPath)).catch(() => {});
      }
  
      res.status(500).json({ message: "Terjadi kesalahan server saat upload pembayaran." });
    } finally {
      conn.release();
    }
  },
    
getBukuAcara : async (req, res) => {
  const { eventId } = req.params;

  try {
    const [rows] = await pool.query(`
      SELECT 
          rc.race_number AS acara,
          CONCAT(rc.distance, ' ', rc.swim_style, ' ', rc.age_group_class, ' ', rc.gender_category) AS lomba,
          hd.heat_number AS seri,
          ROW_NUMBER() OVER (PARTITION BY hd.id ORDER BY 
                                CASE 
                                  WHEN hs.result_time = '' OR hs.result_time IS NULL OR hs.result_time = 'NT' 
                                    THEN 9999
                                  ELSE CAST(REPLACE(hs.result_time, ':', '') AS DECIMAL(10,2))
                                END ASC
                           ) AS rank_no,
          hs.lane_number AS lane,
          hs.swimmer_name AS nama,
          hs.club_name AS klub,
          hs.qet_time AS get_time,
          hs.result_time AS hasil
      FROM heat_swimmers hs
      JOIN heat_details hd ON hs.heat_detail_id = hd.id
      JOIN race_categories rc ON hd.race_category_id = rc.id
      JOIN events e ON rc.event_id = e.id
      WHERE e.id = ?
      ORDER BY rc.race_number, hd.heat_number, rank_no
    `, [eventId]);

    res.json({
      code: 200,
      message: "Data buku acara berhasil diambil",
      detail: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
},

// Fungsi Layanan untuk Mendapatkan Detail Pendaftaran berdasarkan ID
getRegistrationById: async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        code: 400,
        message: "Bad Request",
        detail: "ID registrasi wajib disediakan."
      });
    }

    const [rows] = await pool.execute(
      `SELECT 
          sr.id, sr.full_name, sr.gender, sr.club_name,
          sr.total_fee, sr.payment_status, sr.registration_date,
          sr.email, sr.phone_number,
          sr.date_of_birth, sr.emergency_contact_name, sr.emergency_contact_phone,
          sr.supporting_document_url,
          e.title AS event_title
       FROM swimmer_registrations sr
       JOIN events e ON sr.event_id = e.id
       WHERE sr.id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        code: 404,
        message: "Peserta tidak ditemukan."
      });
    }

    return res.status(200).json({
      code: 200,
      message: "Success",
      data: rows[0]   // kirim object tunggal
    });

  } catch (error) {
    console.error("Error saat mengambil detail peserta:", error);
    return res.status(500).json({
      code: 500,
      message: "Terjadi kesalahan server.",
      detail: error.message
    });
  }
},

 getRegistrationByUserId : async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, event_id, full_name, payment_status, total_fee
       FROM swimmer_registrations 
       WHERE user_id = ?
       ORDER BY registration_date DESC 
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: 'Tidak ada registrasi ditemukan untuk user ini'
      });
    }

    return res.json({
      code: 200,
      message: 'success',
      data: rows[0]
    });
  } catch (err) {
    console.error('Error getRegistrationByUserId:', err);
    return res.status(500).json({
      code: 500,
      message: 'Terjadi kesalahan server'
    });
  }
},

getStatusPaymentById : async (req,res) => {
  const {
    id
  } = req.params;
try{
  const [rows] = await pool.execute(`
    SELECT a.id, b.title, a.full_name, a.payment_status, a.payment_photo_url, a.total_fee
    FROM
    oceantic.swimmer_registrations AS a 
    INNER JOIN
    oceantic.events AS b ON a.event_id = b.id
    WHERE a.id = ?`, [id]);
    console.log('====================================');
    console.log(id);
    console.log('====================================');
    console.log('====================================');
    console.log(rows);
    console.log('====================================');
  res.status(200).json({ code: 200, message: 'success', detail: rows });
}catch{
  console.error('Error in getStatusPaymentById controller:', error);
  res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan data', detail: error.message });

}
},

getAllPayment : async (req,res) => {
 
try{
  const [rows] = await pool.execute(`
    SELECT a.id, b.title, a.registration_date, a.full_name, a.phone_number, a.payment_status, a.payment_photo_url 
    FROM
    oceantic.swimmer_registrations AS a 
    INNER JOIN
    oceantic.events AS b ON a.event_id = b.id`);
  res.status(200).json({ code: 200, message: 'success', detail: rows });
}catch{
  console.error('Error in getAllPayment controller:', error);
  res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan data', detail: error.message });

}
},
 // [API BARU] Mengunggah bukti pembayaran oleh member
 
  uploadPaymentProof: async (req, res) => {
    // upload.single('payment_proof')(req, res, async (err) => {
      const id = req.body.id;

      if (id == 0 || id == null) {
        let response = {
          code: 400,
          message: "Error",
          error: "id / payment tidak terisi",
        };
      return  res.status(400).send(response);
      }
      let image = req.files.image;
      console.log("img", image);
      let filesize = image.size;
      let ext = path.extname(image.name);
      let filename = image.md5 + ext;
      const url = `${process.env.URL_API}/images/${filename}`;
      let allowedType = [".png", ".jpg", ".jpeg"];

      if (!allowedType.includes(ext.toLowerCase())) {
        return res.status(422).json({ msg: "invalid Image" });
      }
      if (filesize > 5000000) {
        return res.status(422).json({ msg: " Size overload" });
      }
      if (image == 0 || image == null) {
        let response = {
          code: 400,
          message: "Error",
          error: "image tidak terisi",
        };
        res.status(400).send(response);
        return response;
      }

    
      image.mv(`./public/images/${filename}`, async (err) => {
        if (err) {
          return res.status(500).json({ msg: err.message });
        }
  
        try {
          let updateQry = `UPDATE swimmer_registrations 
          SET payment_photo_url = ?, updated_at = ?, payment_status = 'Paid'
          WHERE id = ? `;
          let values = [url, getFullTime(), id];
          let hasil = await pool.execute(updateQry, values);
          console.log("update", hasil);
          let response = {
            code: 200,
            message: "success",
            data: "data berhasil masuk",
          };
          console.log(response);
          return res.status(201).send(response);
        } catch (err) {
          console.log(err);
          let response = {
            code: 500,
            message: "error",
            error: err,
          };
          res.status(500).send(response);
        }
      });
  // });

  },
  

updatePaymentStatusAdmin: async (req, res) => {
  const { id, newStatus } = req.body;
  
  if (!id || !newStatus) {
    return res.status(400).json({ code: 400, message: 'ID dan status baru harus disediakan.' });
  }

  // Validasi status yang diizinkan
  const validStatuses = ['Pending','Paid', 'Success', 'Cancelled', 'Refunded'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ code: 400, message: 'Status tidak valid. Gunakan: Pending, Success, atau Failed.' });
  }

  try {
    const [result] = await pool.execute(`
      UPDATE oceantic.swimmer_registrations
      SET payment_status = ?
      WHERE id = ?`,
      [newStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'ID pendaftaran tidak ditemukan.' });
    }

    res.status(200).json({ 
      code: 200, 
      message: 'Status pembayaran berhasil diperbarui.',
      id: id,
      newStatus: newStatus
    });
  } catch (error) {
    console.error('Error in updatePaymentStatusAdmin controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat memperbarui status pembayaran.', detail: error.message });
  }
},

// Fungsi Layanan untuk Memperbarui Pendaftaran
updateRegistration: async (id, updateData, paymentPhotoFileArg, supportingDocumentFileArg) => {
  let paymentPhotoPath = null;
  let supportingDocumentPath = null;
  let oldPaymentPhotoPath = null;
  let oldSupportingDocumentPath = null;

  // Ambil objek file dengan aman.
  const paymentPhoto = Array.isArray(paymentPhotoFileArg) ? paymentPhotoFileArg[0] : paymentPhotoFileArg;
  const supportingDocument = Array.isArray(supportingDocumentFileArg) ? supportingDocumentFileArg[0] : supportingDocumentFileArg;

  try {
    // Ambil data lama untuk path file lama
    const [oldRegistrationRows] = await pool.execute(
      'SELECT payment_photo_url, supporting_document_url FROM swimmer_registrations WHERE id = ?', 
      [id]
    );
    if (oldRegistrationRows.length > 0) {
      oldPaymentPhotoPath = oldRegistrationRows[0].payment_photo_url;
      oldSupportingDocumentPath = oldRegistrationRows[0].supporting_document_url;
    }

    // Handle upload bukti pembayaran
    if (paymentPhoto && typeof paymentPhoto.name === 'string' && paymentPhoto.name.length > 0 && typeof paymentPhoto.mv === 'function') {
      const uploadDir = path.join(__dirname, '../public/uploads/payments');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${paymentPhoto.name}`;
      paymentPhotoPath = `/uploads/payments/${fileName}`;
      await paymentPhoto.mv(path.join(uploadDir, fileName));

      if (oldPaymentPhotoPath) {
        await fs.unlink(path.join(__dirname, '../public', oldPaymentPhotoPath))
          .catch(err => console.warn('Gagal hapus file pembayaran lama:', err.message));
      }
    } else {
      paymentPhotoPath = oldPaymentPhotoPath;
    }

    // Handle upload dokumen pendukung
    if (supportingDocument && typeof supportingDocument.name === 'string' && supportingDocument.name.length > 0 && typeof supportingDocument.mv === 'function') {
      const uploadDir = path.join(__dirname, '../public/uploads/documents');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${supportingDocument.name}`;
      supportingDocumentPath = `/uploads/documents/${fileName}`;
      await supportingDocument.mv(path.join(uploadDir, fileName));

      if (oldSupportingDocumentPath) {
        await fs.unlink(path.join(__dirname, '../public', oldSupportingDocumentPath))
          .catch(err => console.warn('Gagal hapus dokumen lama:', err.message));
      }
    } else {
      supportingDocumentPath = oldSupportingDocumentPath;
    }

    // Kolom yang boleh diupdate
    const allowedFields = [
      "full_name", "gender", "club_name", "total_fee", "payment_status",
      "registration_date", "email", "phone_number", "date_of_birth",
      "emergency_contact_name", "emergency_contact_phone"
    ];

    const updates = [];
    const params = [];

    // Loop field dari body
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    });

    // Tambahkan file kalau ada
    if (paymentPhotoPath) {
      updates.push(`payment_photo_url = ?`);
      params.push(paymentPhotoPath);
    }
    if (supportingDocumentPath) {
      updates.push(`supporting_document_url = ?`);
      params.push(supportingDocumentPath);
    }

    if (updates.length === 0) return 0;

    const sql = `
      UPDATE swimmer_registrations 
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = ?
    `;
    params.push(id);

    console.log("SQL Update:", sql);
    console.log("Params:", params);

    const [result] = await pool.execute(sql, params);
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