const { json } = require('express');
const pool = require('../config/db'); // Import pool koneksi database
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises'); // Tambahkan modul fs/promises
const ExcelJS = require("exceljs");
require('dotenv').config(); // Memuat variabel lingkungan dari .env


// const PDFDocument = require("pdfkit");


// const escape = (s) => {
//   if (s === undefined || s === null) return "";
//   return String(s)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// };
// // const buildHtmlFromEventBook = (eventBook, template) => {
// //   const { namaEvent, date, location, detailCompetition } = eventBook;
// //   const formattedDate = new Date(date).toLocaleDateString("id-ID", {
// //     day: "2-digit",
// //     month: "long",
// //     year: "numeric",
// //   });
// //   const currentDate = new Date().toLocaleDateString("id-ID");

// //   const competitionHtml = (detailCompetition || [])
// //     .map((comp) => {
// //       const headerText = `Acara ${escape(comp.acara)} | ${escape(
// //         comp.jarak
// //       )} ${escape(comp.gaya)} - ${escape(comp.gender)} | Golongan: ${escape(
// //         comp.golongan
// //       )}`;

// //       const swimmersRows = (comp.detailSwimmer || [])
// //         .map((sw) => {
// //           return `
// //             <tr>
// //               <td class="cell small">${escape(sw.seri)}</td>
// //               <td class="cell small">${escape(sw.grup)}</td>
// //               <td class="cell small">${escape(sw.lint)}</td>
// //               <td class="cell name">${escape(sw.nama)}</td>
// //               <td class="cell small">${escape(sw.club)}</td>
// //               <td class="cell school">${escape(sw.qet)}</td>
// //               <td class="cell small">${escape(sw.hasil)}</td>
// //             </tr>
// //           `;
// //         })
// //         .join("");

// //       return `
// //         <div class="competition-section">
// //           <div class="competition-header">${headerText}</div>
// //           <div class="table-wrapper">
// //             <table>
// //               <thead>
// //                 <tr>
// //                   <th>Seri</th>
// //                   <th>Grup</th>
// //                   <th>Lint</th>
// //                   <th>Nama</th>
// //                   <th>Asal Sekolah/Club</th>
// //                   <th>QET</th>
// //                   <th>Hasil</th>
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 ${swimmersRows || `<tr><td colspan="7" style="text-align:center;">Tidak ada peserta</td></tr>`}
// //               </tbody>
// //             </table>
// //           </div>
// //         </div>
// //       `;
// //     })
// //     .join("");

// //   // Mengisi placeholder dalam template dengan data acara
// //   return template
// //     .replace('{{namaEvent}}', escape(namaEvent))
// //     .replace('{{formattedDate}}', escape(formattedDate))
// //     .replace('{{location}}', escape(location))
// //     .replace('{{competitionHtml}}', competitionHtml)
// //     .replace('{{currentDate}}', currentDate);
// // };
// function buildHtmlFromEventBook(eventDetail, swimmers, htmlTemplate) {
//   // Render header event
//   let html = htmlTemplate
//     .replace("{{EVENT_TITLE}}", eventDetail.title)
//     .replace("{{EVENT_DATE}}", new Date(eventDetail.event_date).toLocaleDateString("id-ID"))
//     .replace("{{EVENT_LOCATION}}", eventDetail.location);

//   // Render daftar startlist
//   const rowsHtml = swimmers.map((s, i) => `
//     <tr>
//       <td>${i + 1}</td>
//       <td>${s.full_name}</td>
//       <td>${s.club_name}</td>
//       <td>${s.swim_style}</td>
//       <td>${s.distance}</td>
//       <td>${s.age_group_class}</td>
//       <td>${s.gender_category}</td>
//     </tr>
//   `).join("");

//   html = html.replace("{{STARTLIST_ROWS}}", rowsHtml);

//   return html;
// }

function assignLaneAndHeat(swimmers, lanesPerHeat = 8) {
  const heats = [];
  let currentHeat = [];
  let heatNumber = 1;

  swimmers.forEach((swimmer, index) => {
    // Tentukan lane (1 - lanesPerHeat)
    const lane = (index % lanesPerHeat) + 1;

    // Tambahkan data lane ke swimmer
    const swimmerWithLane = {
      ...swimmer,
      lane,
      heat: heatNumber,
    };

    currentHeat.push(swimmerWithLane);

    // Kalau heat sudah penuh -> push ke heats dan reset
    if (lane === lanesPerHeat || index === swimmers.length - 1) {
      heats.push({
        heatNumber,
        swimmers: currentHeat,
      });
      currentHeat = [];
      heatNumber++;
    }
  });

  return heats;
}

module.exports = assignLaneAndHeat;

let event = {
 createEvent : async (req, res) => {
  const {
    title,
    event_date,
    location,
    description,
    registration_start_date,
    registration_end_date,
    event_status
  } = req.body;

  // Validasi input dasar
  if (!title || !event_date || !location) {
    return res.status(400).json({ 
      code:400,
      message: 'Bad Request',
    detail:`Judul, tanggal event, dan lokasi wajib diisi.`
    })}

  try {
    const [result] = await pool.execute(

      `INSERT INTO events (
      title, event_date, location, description,
       registration_start_date, registration_end_date, event_status,
        created_at, updated_at) 
         VALUES ('${title}', '${event_date}', '${location}', '${description}', '${registration_start_date}', '${registration_end_date}', '${event_status}', NOW(), NOW());`

      
    );

    res.status(201).json({
      code:201,
      message: 'Created',
      detail:`event  ${result.insertId} created`
    });
  } catch (error) {
    console.error('Error saat membuat event:', error);
    res.status(500).json({ 
      code:500,
      message: 'error',
      detail:`Terjadi kesalahan server saat membuat event: ${error.message}`});
  }
},
// 2. Fungsi untuk Mendapatkan Semua Event

 getAllEvents : async (req, res) => {
  console.log("hhhhh");
  
  try {
    const [rows] = await pool.execute('SELECT * FROM events ORDER BY event_date DESC ');
    res.status(200).json({code: 200, message: 'Success', data: rows });
  
  } catch (error) {
    console.error('Error saat mendapatkan semua event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

getAllEventsOpen : async (req, res) => {
  console.log('====================================');
  console.log('getAllEventsOpen');
  console.log('====================================');
  try {
    const [rows] = await pool.execute("SELECT * FROM events WHERE event_status = 'Open for Registration'  ORDER BY event_date DESC");
    
    res.status(200).json({ code: 200, message: 'Success', data: rows });
   
  } catch (error) {
    console.error('Error saat mendapatkan semua event:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server.', detail: error });
  }
},

getEventBook: async (req, res) => {
  const { eventId } = req.body; // Ambil eventId dari body request

  // Validasi input awal
  if (!eventId) {
    return res.status(400).json({ 
      code: 400, 
      message: 'Event ID wajib disediakan.', 
      detail: null 
    });
  }

  try {
    // Panggil stored procedure GetEventBookData
    const [rows] = await pool.execute('CALL GetEventBookData(?)', [eventId]);

    // Hapus console.log yang bermasalah
    // console.log('====================================');
    // console.log(rows);
    // console.log(JSON.parse(rows.detailCompetition));
    // console.log('====================================');

    // Periksa apakah set hasil pertama ada dan tidak kosong
    if (rows && rows[0] && rows[0].length > 0) {
      const eventData = rows[0][0]; // Ambil baris pertama dari set hasil pertama

      // Periksa dan pastikan detailCompetition adalah array. 
      // Berdasarkan log Anda, ini sudah array, jadi kita tidak perlu JSON.parse.
      // Jika detailCompetition tidak ada atau null, kita default ke array kosong.
      if (!eventData.detailCompetition) {
        eventData.detailCompetition = [];
      }
      
      res.status(200).json({ 
        code: 200, 
        message: 'Data buku acara berhasil diambil.', 
        detail: eventData 
      });
    } else {
      res.status(404).json({ 
        code: 404, 
        message: 'Buku acara untuk event ini tidak ditemukan.', 
        detail: null 
      });
    }
  } catch (error) {
    console.error('Error in getEventBook controller:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Terjadi kesalahan server saat mengambil buku acara.', 
      detail: error.message 
    });
  }
},

getStartList : async (req, res) => {
  try {
    const eventId = Number(req.params.event_id || req.query.event_id || req.body.event_id);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ message: 'eventId tidak valid' });
    }

    // Ambil data dasar peserta per lomba
    const [rows] = await pool.execute(`
      SELECT 
        rc.id AS race_id,
        rc.race_number,
        rc.distance,
        rc.swim_style,
        rc.age_group_class,
        rc.gender_category,
        sr.full_name,
        sr.club_name,
        sr.id AS registration_id
      FROM swimmer_events se
      INNER JOIN swimmer_registrations sr ON se.registration_id = sr.id
      INNER JOIN race_categories rc ON se.race_category_id = rc.id
      WHERE sr.event_id = ? AND sr.payment_status IN ('Paid','Success')
      ORDER BY rc.race_number, sr.full_name
    `, [eventId]);

    if (!rows.length) {
      return res.status(200).json({ message: 'Belum ada peserta yang terdaftar.' });
    }

    // Grouping per race
    const startList = {};
    rows.forEach(row => {
      const raceKey = `Acara ${row.race_number} | ${row.distance} ${row.swim_style} ${row.age_group_class} ${row.gender_category}`;
      if (!startList[raceKey]) startList[raceKey] = [];
      startList[raceKey].push({
        registration_id: row.registration_id,
        full_name: row.full_name,
        club_name: row.club_name
      });
    });

    // Tambahkan pembagian ke Seri, Grup, Lintasan
    const formattedStartList = {};
    Object.keys(startList).forEach(raceKey => {
      const swimmers = startList[raceKey];
      const raceResult = [];

      let seriCounter = 1;
      const groupLabels = ['A', 'B', 'C']; // hanya 3 grup

      // Loop seri, tiap seri max 12 orang
      for (let i = 0; i < swimmers.length; i += 12) {
        const seriSwimmers = swimmers.slice(i, i + 12);

        let groupIndex = 0;

        // Loop grup (4 orang per grup)
        for (let j = 0; j < seriSwimmers.length; j += 4) {
          const groupSwimmers = seriSwimmers.slice(j, j + 4);

          groupSwimmers.forEach((swimmer, laneIdx) => {
            raceResult.push({
              seri: seriCounter,
              group: groupLabels[groupIndex] || "-",
              lane: laneIdx + 1,
              full_name: swimmer.full_name,
              club_name: swimmer.club_name,
              qet: '',   // kolom kosong untuk panitia
              hasil: ''  // kolom kosong untuk panitia
            });
          });

          groupIndex++;
        }

        seriCounter++;
      }

      formattedStartList[raceKey] = raceResult;
    });

    return res.status(200).json({
      code: 200,
      message: 'Start List berhasil di-generate.',
      event_id: eventId,
      startList: formattedStartList
    });

  } catch (err) {
    console.error('Error getStartList:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.', detail: err.message });
  }
},


//   try {
//     const { eventId } = req.body;
//     if (!eventId) {
//       return res.status(400).json({ message: "eventId harus disediakan di body request." });
//     }

//     // 1. Ambil detail event (kop buku acara)
//     const [eventRows] = await pool.query(
//       `SELECT title, event_date, location 
//        FROM oceantic.events 
//        WHERE id = ?`,
//       [eventId]
//     );
//     if (eventRows.length === 0) {
//       return res.status(404).json({ message: "Event tidak ditemukan." });
//     }
//     const eventData = eventRows[0];

//     // 2. Ambil start list dari API kita sendiri
//     const apiResponse = await axios.get(
//       ` ${process.env.URL_API}/oceantic/v1/getStartList/${eventId}`
//     );
//     const startList = apiResponse?.data?.startList;
//     if (!startList || Object.keys(startList).length === 0) {
//       return res.status(404).json({ message: "Belum ada peserta yang terdaftar." });
//     }

//     // 3. Bangun HTML
//     let htmlContent = `
//       <html>
//       <head>
//         <style>
//           body { font-family: Arial, sans-serif; }
//           h1, h2, h3 { text-align: center; }
//           table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//           th, td { border: 1px solid #000; padding: 6px; text-align: center; }
//           th { background-color: #f2f2f2; }
//           .event-title { margin-top: 40px; font-size: 18px; }
//         </style>
//       </head>
//       <body>
//         <h1>${eventData.title}</h1>
//         <h3>${new Date(eventData.event_date).toLocaleDateString("id-ID")} | ${eventData.location}</h3>
//     `;

//     // Loop per lomba
//     for (const [raceName, seriesList] of Object.entries(startList)) {
//       htmlContent += `<h2 class="event-title">${raceName}</h2>`;

//       seriesList.forEach(series => {
//         htmlContent += `<h3>Seri ${series.series}</h3>`;
//         htmlContent += `
//           <table>
//             <thead>
//               <tr>
//                 <th>Seri</th>
//                 <th>Grup</th>
//                 <th>Lane</th>
//                 <th>Nama</th>
//                 <th>Club</th>
//                 <th>QET</th>
//                 <th>Hasil</th>
//               </tr>
//             </thead>
//             <tbody>
//         `;

//         series.groups.forEach(group => {
//           group.swimmers.forEach(swimmer => {
//             htmlContent += `
//               <tr>
//                 <td>${swimmer.series}</td>
//                 <td>${swimmer.group}</td>
//                 <td>${swimmer.lane}</td>
//                 <td>${swimmer.full_name}</td>
//                 <td>${swimmer.club_name}</td>
//                 <td>${swimmer.qet || ""}</td>
//                 <td>${swimmer.hasil || ""}</td>
//               </tr>
//             `;
//           });
//         });

//         htmlContent += `</tbody></table>`;
//       });
//     }

//     htmlContent += `</body></html>`;

//     // 4. Generate PDF dengan Puppeteer
//     const browser = await puppeteer.launch({
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });
//     const page = await browser.newPage();
//     await page.setContent(htmlContent, { waitUntil: "networkidle0" });
//     const pdfBuffer = await page.pdf({
//       format: "A4",
//       printBackground: true,
//       margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
//     });
//     await browser.close();

//     // 5. Kirim PDF ke response
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="buku_acara_${eventId}.pdf"`
//     );
//     res.send(pdfBuffer);

//   } catch (error) {
//     console.error("Gagal menghasilkan PDF:", error);
//     res.status(500).json({ message: "Terjadi kesalahan saat membuat PDF", error: error.message });
//   }
// },

 generateEventBookPdf : async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: "eventId harus disediakan di body request." });
    }

    // Ambil data header event
    const [eventRows] = await pool.execute(
      "SELECT title, event_date, location FROM events WHERE id = ?",
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }
    const eventData = eventRows[0];

    // Ambil Start List lewat API internal
    const apiResponse = await axios.get(`${process.env.URL_API}/oceantic/v1/getStartList/${eventId}`);
    const startList = apiResponse?.data?.startList;

    if (!startList || Object.keys(startList).length === 0) {
      return res.status(404).json({ message: "Belum ada peserta yang terdaftar." });
    }

    // Bangun HTML
    let htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          h1, h2, h3 { text-align: center; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 11px; }
          th { background: #f2f2f2; }
          .race-title { margin-top: 30px; font-size: 14px; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${eventData.title}</h1>
        <h3>${new Date(eventData.event_date).toLocaleDateString("id-ID")} - ${eventData.location}</h3>
    `;

    Object.entries(startList).forEach(([raceKey, swimmers]) => {
      htmlContent += `<div class="race-title">${raceKey}</div>`;

      htmlContent += `
        <table>
          <thead>
            <tr>
              <th>Seri</th>
              <th>Grup</th>
              <th>Lint</th>
              <th>Nama Perenang</th>
              <th>Asal Club</th>
              <th>QET</th>
              <th>Hasil</th>
            </tr>
          </thead>
          <tbody>
      `;

      // --- Grouping by Seri & Grup ---
      let seriGroups = {};
      swimmers.forEach(swimmer => {
        const seriKey = swimmer.seri || "-";
        const groupKey = swimmer.group || "-";

        if (!seriGroups[seriKey]) seriGroups[seriKey] = {};
        if (!seriGroups[seriKey][groupKey]) seriGroups[seriKey][groupKey] = [];
        seriGroups[seriKey][groupKey].push(swimmer);
      });

      // Render tabel
      Object.entries(seriGroups).forEach(([seri, groupMap]) => {
        const seriRowspan = Object.values(groupMap).reduce((sum, g) => sum + g.length, 0);

        let seriPrinted = false;
        Object.entries(groupMap).forEach(([group, swimmerList]) => {
          const groupRowspan = swimmerList.length;

          let groupPrinted = false;
          swimmerList.forEach((swimmer) => {
            htmlContent += "<tr>";

            // Cetak Seri sekali dengan rowspan total
            if (!seriPrinted) {
              htmlContent += `<td rowspan="${seriRowspan}">${seri}</td>`;
              seriPrinted = true;
            }

            // Cetak Grup sekali dengan rowspan grup
            if (!groupPrinted) {
              htmlContent += `<td rowspan="${groupRowspan}">${group}</td>`;
              groupPrinted = true;
            }

            // Kolom lainnya
            htmlContent += `
              <td>${swimmer.lane || ""}</td>
              <td>${swimmer.full_name}</td>
              <td>${swimmer.club_name}</td>
              <td>${swimmer.qet || ""}</td>
              <td>${swimmer.hasil || ""}</td>
            `;

            htmlContent += "</tr>";
          });
        });
      });

      htmlContent += `</tbody></table>`;
    });

    htmlContent += `</body></html>`;

    // Generate PDF dengan Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    await browser.close();

    // Kirim PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="buku_acara_${eventData.title.replace(/\s+/g, "_").toLowerCase()}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Gagal menghasilkan PDF:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat membuat PDF", error: error.message });
  }
},

 generateEventBookExcel : async (req, res) => {
  
  try {
    const { eventId } = req.body;
    console.log('====================================');
  console.log(eventId);
  console.log('====================================');
    if (!eventId) {
      return res.status(400).json({ message: "eventId harus disediakan." });
    }

    // Ambil data event
    const [eventRows] = await pool.execute(
      "SELECT title, event_date, location FROM events WHERE id = ?",
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }
    const eventData = eventRows[0];

    // Ambil startlist
    const apiResponse = await axios.get(
      `${process.env.URL_API}/oceantic/v1/getStartList/${eventId}`
    );
    const startList = apiResponse?.data?.startList;

    if (!startList || Object.keys(startList).length === 0) {
      return res.status(404).json({ message: "Belum ada peserta yang terdaftar." });
    }

    // Buat workbook & sheet
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Start List");

    // Header event
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").value = eventData.title;
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A1").font = { size: 16, bold: true };

    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").value = `${new Date(eventData.event_date).toLocaleDateString("id-ID")} - ${eventData.location}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    let rowPointer = 4;

    // Loop tiap race
    Object.entries(startList).forEach(([raceKey, swimmers]) => {
      // Judul Race
      sheet.mergeCells(`A${rowPointer}:G${rowPointer}`);
      sheet.getCell(`A${rowPointer}`).value = raceKey;
      sheet.getCell(`A${rowPointer}`).font = { bold: true };
      rowPointer++;

      // Header tabel
      sheet.addRow([
        "Seri",
        "Grup",
        "Lint",
        "Nama Perenang",
        "Asal Club",
        "QET",
        "Hasil",
      ]).font = { bold: true };

      // --- Grouping Seri & Grup ---
      let seriGroups = {};
      swimmers.forEach(swimmer => {
        const seriKey = swimmer.seri || "-";
        const groupKey = swimmer.group || "-";
        if (!seriGroups[seriKey]) seriGroups[seriKey] = {};
        if (!seriGroups[seriKey][groupKey]) seriGroups[seriKey][groupKey] = [];
        seriGroups[seriKey][groupKey].push(swimmer);
      });

      Object.entries(seriGroups).forEach(([seri, groupMap]) => {
        Object.entries(groupMap).forEach(([group, swimmerList]) => {
          swimmerList.forEach(swimmer => {
            sheet.addRow([
              seri,
              group,
              swimmer.lane || "",
              swimmer.full_name,
              swimmer.club_name,
              "",
              ""
            ]);
          });
        });
      });

      rowPointer = sheet.lastRow.number + 2;
    });

    // Autofit kolom
    sheet.columns.forEach(col => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      col.width = maxLength < 15 ? 15 : maxLength;
    });

    // Kirim response Excel
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=startlist_${eventData.title.replace(/\s+/g, "_")}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Gagal generate Excel:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat membuat Excel", error: error.message });
  }
},
getEventById : async (req, res) => {
  console.log("c");

  const { id } = req.params; // Ambil ID dari parameter URL

  try {
    const [rows] = await pool.execute('SELECT * FROM events WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error saat mendapatkan event berdasarkan ID:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

// 4. Fungsi untuk Memperbarui Event
 updateEvent : async (req, res) => {
  console.log("b");

  const { id } = req.params; // Ambil ID dari parameter URL
  const {
    title,
    event_date,
    location,
    description,
    category_info,
    registration_start_date,
    registration_end_date,
    event_status
  } = req.body;

  try {
    // Bangun query UPDATE secara dinamis
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (event_date !== undefined) { fields.push('event_date = ?'); values.push(event_date); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (category_info !== undefined) { fields.push('category_info = ?'); values.push(category_info); }
    if (registration_start_date !== undefined) { fields.push('registration_start_date = ?'); values.push(registration_start_date); }
    if (registration_end_date !== undefined) { fields.push('registration_end_date = ?'); values.push(registration_end_date); }
    if (event_status !== undefined) { fields.push('event_status = ?'); values.push(event_status); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada data yang disediakan untuk diperbarui.' });
    }

    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id); // Tambahkan ID ke akhir array values

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan atau tidak ada perubahan.' });
    }

    res.status(200).json({ message: 'Event berhasil diperbarui.' });
  } catch (error) {
    console.error('Error saat memperbarui event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui event.' });
  }
},

// 5. Fungsi untuk Menghapus Event
 deleteEvent : async (req, res) => {
  console.log("a");
  
  const { id } = req.params; // Ambil ID dari parameter URL

  try {
    const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan.' });
    }

    res.status(200).json({ message: 'Event berhasil dihapus.' });
  } catch (error) {
    console.error('Error saat menghapus event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat menghapus event.' });
  }
}

}


module.exports = event;
