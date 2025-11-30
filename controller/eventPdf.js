const pool = require('../config/db'); // Import pool koneksi database
const path = require('path'); // Untuk manipulasi path file
const fs = require('fs/promises'); // Untuk operasi file sistem berbasis Promise

let eventPdf = {
  getAllEventPDF: async (req, res) => {
    try {
      // bisa tambahkan filter event_id nanti jika diperlukan
      const sql = `
        SELECT *
        FROM eventFiles
        ORDER BY created_at DESC
      `;
  
      const [rows] = await pool.execute(sql);
  
      // Jika kosong
      if (!rows || rows.length === 0) {
        return res.status(400).json({
          code: 400,
          message: "error",
          data: [],
          detail: "data tidak ditemukan"
        });
      }
  
      return res.status(200).json({
        code: 200,
        message: "success",
        data: rows
      });
  
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        code: 500,
        message: "error",
        detail: err.message
      });
    }
  },  
  getById: async (req, res) => {
    const id = req.params.id;
  
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM eventFiles WHERE id = ?",
        [id]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "error",
          error: "Data tidak ditemukan",
        });
      }
  
      return res.status(200).json({
        code: 200,
        message: "success",
        data: rows[0],
      });
  
    } catch (err) {
      return res.status(500).json({
        code: 500,
        message: "error",
        error: err,
      });
    }
  },  
    uploadEventPDF: async (req, res) => {
        const { event_id, title, category } = req.body;
      
        if (!event_id) {
          return res.status(400).json({
            code: 400,
            message: "Error",
            error: "event_id wajib diisi",
          });
        }
      
        if (!category) {
          return res.status(400).json({
            code: 400,
            message: "Error",
            error: "category wajib diisi",
          });
        }
      
        let pdf = req.files?.pdf;
      
        if (!pdf) {
          return res.status(400).json({
            code: 400,
            message: "Error",
            error: "File PDF tidak terisi",
          });
        }
      
        let ext = path.extname(pdf.name).toLowerCase();
        if (ext !== ".pdf") {
          return res.status(422).json({
            code: 422,
            message: "Error",
            error: "File harus PDF",
          });
        }
      
        if (pdf.size > 10000000) {
          return res.status(422).json({
            code: 422,
            message: "Error",
            error: "Ukuran file tidak boleh lebih dari 10MB",
          });
        }
      
        let filename = pdf.md5 + ext;
        const url = `${process.env.URL_API}/uploads/documents/${filename}`;
      
        pdf.mv(`./public/uploads/documents/${filename}`, async (err) => {
          if (err) {
            return res.status(500).json({
              code: 500,
              message: "error",
              error: err.message,
            });
          }
      
          try {
            let insertQry = `
              INSERT INTO eventFiles (event_id, title, category, file_url, file_name)
              VALUES (?, ?, ?, ?, ?)
            `;
      
            let values = [event_id, title ?? null, category, url, filename];
            await pool.execute(insertQry, values);
      
            return res.status(200).json({
              code: 200,
              message: "success",
              data: "PDF berhasil diupload",
            });
          } catch (err) {
            return res.status(500).json({
              code: 500,
              message: "error",
              error: err,
            });
          }
        });
      },
      getEventPDF: async (req, res) => {
        const event_id = req.params.event_id;
        const category = req.query.category; // optional
      
        try {
          let query = `SELECT * FROM eventFiles WHERE event_id = ?`;
          let params = [event_id];
      
          if (category) {
            query += ` AND category = ?`;
            params.push(category);
          }
      
          let [rows] = await pool.execute(query, params);
      
          if (rows.length === 0) {
            return res.status(404).json({
              code: 404,
              message: "error",
              error: "File event tidak ditemukan",
            });
          }
      
          return res.status(200).json({
            code: 200,
            message: "success",
            data: rows,
          });
        } catch (err) {
          return res.status(500).json({
            code: 500,
            message: "error",
            error: err,
          });
        }
      },
      editEventPDF: async (req, res) => {
        const { id, title, category } = req.body;
      
        if (!id) {
          return res.status(400).json({
            code: 400,
            message: "Error",
            error: "id wajib diisi",
          });
        }
      
        let [rows] = await pool.execute(
          `SELECT file_name FROM eventFiles WHERE id = ?`,
          [id]
        );
      
        if (rows.length === 0) {
          return res.status(404).json({
            code: 404,
            message: "Error",
            error: "Data tidak ditemukan",
          });
        }
      
        let oldFile = rows[0].file_name;
        let newFileName = oldFile;
      
        if (req.files?.pdf) {
          let pdf = req.files.pdf;
          let ext = path.extname(pdf.name).toLowerCase();
      
          if (ext !== ".pdf") {
            return res.status(422).json({
              code: 422,
              message: "error",
              error: "File harus PDF",
            });
          }
      
          newFileName = pdf.md5 + ext;
          pdf.mv(`./public/pdf/${newFileName}`);
      
          const oldPath = `./public/pdf/${oldFile}`;
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      
        const file_url = `${process.env.URL_API}/pdf/${newFileName}`;
      
        await pool.execute(
          `UPDATE eventFiles
           SET title = ?, category = ?, file_url = ?, file_name = ?, updated_at = ?
           WHERE id = ?`,
          [title, category, file_url, newFileName, new Date(), id]
        );
      
        return res.status(200).json({
          code: 200,
          message: "success",
          data: "PDF berhasil diupdate",
        });
      },
      deleteEventPDF: async (req, res) => {
        const id = req.params.id;
      
        try {
          let [rows] = await pool.execute(
            `SELECT file_name FROM eventFiles WHERE id = ?`,
            [id]
          );
      
          if (rows.length === 0) {
            return res.status(404).json({
              code: 404,
              message: "error",
              error: "Data tidak ditemukan",
            });
          }
      
          const filePath = `./public/pdf/${rows[0].file_name}`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
      
          await pool.execute(`DELETE FROM eventFiles WHERE id = ?`, [id]);
      
          return res.status(200).json({
            code: 200,
            message: "success",
            data: "PDF berhasil dihapus",
          });
        } catch (err) {
          return res.status(500).json({
            code: 500,
            message: "error",
            error: err,
          });
        }
      }      
      
      
      
}
module.exports = eventPdf;
