import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlySheet, DigitalSignature } from '../types';
import { loghiOriginali } from '../assets/originalAssets';
import { loadOriginalPublicImage } from './imageLoader';

// Helper to await and resolve authentic user signature image before embedding in PDF
async function resolveSignatureForPdf(sig?: DigitalSignature): Promise<{
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  aspect: number;
} | null> {
  if (!sig) return null;

  let base64 = sig.dataUrl;

  // If dataUrl is missing or invalid but url is provided, fetch via authenticated API
  if ((!base64 || !base64.startsWith('data:image/')) && sig.url) {
    try {
      const token =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('set118_auth_token') || localStorage.getItem('set118_auth_token')
          : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(sig.url, { headers });
      if (res.ok) {
        const blob = await res.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn('Could not fetch signature image via url:', e);
    }
  }

  if (!base64 || !base64.startsWith('data:image/')) return null;

  // Await image loading to determine natural dimensions and exact aspect ratio
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = img.naturalWidth || img.width || 100;
      const height = img.naturalHeight || img.height || 50;
      const aspect = width / height;
      const isJpeg = base64!.startsWith('data:image/jpeg') || base64!.startsWith('data:image/jpg');
      resolve({
        dataUrl: base64!,
        format: isJpeg ? 'JPEG' : 'PNG',
        aspect,
      });
    };
    img.onerror = () => {
      console.warn('Failed to decode signature image in Image object');
      resolve(null);
    };
    img.src = base64;
  });
}

export async function generateOfficialSet118Pdf(sheet: MonthlySheet): Promise<jsPDF> {
  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const marginX = 14;

  // Header Left: Original approved logo strip containing "Sanitaservice ASL TA s.r.l. Unipersonale" and "ASL Taranto PugliaSalute"
  // Loaded directly from public file: const loghiOriginali = "/loghi_originali_pdf.png";
  // Strictly preserving original proportions, colors, transparency, and raster fidelity with zero distortion.
  try {
    const logoImg = await loadOriginalPublicImage(loghiOriginali);
    const aspect = logoImg.aspect;
    const maxW = 100;
    const maxH = 18;
    let renderW = maxW;
    let renderH = maxW / aspect;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = maxH * aspect;
    }
    doc.addImage(logoImg.data, logoImg.format, marginX, 8, renderW, renderH);
  } catch (err) {
    console.warn('Original Sanitaservice/ASL Taranto logo could not be embedded; leaving space blank as required:', err);
  }

  // Header Right: "S.E.T. 118"
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text('S.E.T. 118', pageWidth - marginX - 45, 22);

  // Sub-header Lines
  const dipendenteStr = sheet.dipendente
    ? `${sheet.dipendente.cognome || ''} ${sheet.dipendente.nome || ''}`.trim()
    : '';
  const matricolaStr = sheet.dipendente?.matricola || '';
  const postazioneStr = sheet.dipendente?.postazione || '';
  const meseStr = sheet.nomeMese || '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  // Line 1: STRAORDINARIO DEL DIPENDENTE _________ N° MATR. ________
  const yLine1 = 39;
  doc.text('STRAORDINARIO DEL DIPENDENTE', marginX + 35, yLine1);
  const depStart = marginX + 96;
  doc.setFont('helvetica', 'normal');
  doc.text(dipendenteStr || '___________________________________', depStart, yLine1);
  
  doc.setFont('helvetica', 'bold');
  doc.text('N° MATR.', marginX + 175, yLine1);
  doc.setFont('helvetica', 'normal');
  doc.text(matricolaStr || '___________', marginX + 195, yLine1);

  // Line 2: POSTAZIONE DI _________________ EFFETTUATO NEL MESE DI ____________
  const yLine2 = 47;
  doc.setFont('helvetica', 'bold');
  doc.text('POSTAZIONE DI', marginX + 35, yLine2);
  doc.setFont('helvetica', 'normal');
  doc.text(postazioneStr || '___________________________', marginX + 68, yLine2);

  doc.setFont('helvetica', 'bold');
  doc.text('EFFETTUATO NEL MESE DI', marginX + 130, yLine2);
  doc.setFont('helvetica', 'normal');
  doc.text(meseStr || '____________________', marginX + 180, yLine2);

  // Prepare table data
  // Exactly 7 columns as in original file
  const tableHeaders = [
    [
      { content: 'GIORNO', styles: { halign: 'center' as const } },
      { content: 'ORARIO ORDINARIO', styles: { halign: 'center' as const } },
      { content: 'ORARIO\nSTRAORDINARIO', styles: { halign: 'center' as const } },
      { content: 'MOTIVO DELLO STRAORDINARIO', styles: { halign: 'left' as const } },
      { content: 'N.TOTALE ORE\nMONTE ORE', styles: { halign: 'center' as const } },
      { content: 'N.TOTALE ORE DI\nSTRAORDINARIO', styles: { halign: 'center' as const } },
      { content: 'FIRMA COORDINATORE\nPER AUTORIZZAZIONE', styles: { halign: 'center' as const } },
    ],
  ];

  // Populate entries, ensuring at least 11 rows to fit cleanly on a single page
  const rows: (string | { content: string; styles?: any; colSpan?: number })[][] = [];
  const entriesCount = sheet.entries ? sheet.entries.length : 0;
  const minRows = Math.max(11, entriesCount);

  for (let i = 0; i < minRows; i++) {
    if (i < entriesCount) {
      const e = sheet.entries[i];
      rows.push([
        { content: e.giorno || '', styles: { halign: 'center', valign: 'middle' } },
        { content: e.orarioOrdinario || '', styles: { halign: 'center', valign: 'middle' } },
        { content: e.orarioStraordinario || '', styles: { halign: 'center', valign: 'middle' } },
        { content: e.motivo || '', styles: { halign: 'left', valign: 'middle' } },
        { content: e.totaleOreMonteOre || '', styles: { halign: 'center', valign: 'middle' } },
        { content: e.totaleOreStraordinario || '', styles: { halign: 'center', valign: 'middle' } },
        { content: e.firmaCoordinatore || '', styles: { halign: 'center', valign: 'middle' } },
      ]);
    } else {
      // Empty grid row matching original template with uniform height
      rows.push(['', '', '', '', '', '', '']);
    }
  }

  // Add Totals Row with clean colSpan across the first 4 columns
  rows.push([
    {
      content: `TOTALE COMPLESSIVO ORE SVOLTE:   ${sheet.totaleOreComplessivoFormatted || '0h 00m'}`,
      colSpan: 4,
      styles: {
        halign: 'right',
        valign: 'middle',
        fontStyle: 'bold',
        fontSize: 8.5,
        textColor: [15, 23, 42],
        fillColor: [241, 245, 249],
      },
    },
    {
      content: sheet.totaleOreMonteOreFormatted || '0h 00m',
      styles: {
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold',
        fontSize: 8.5,
        textColor: [180, 83, 9],
        fillColor: [254, 243, 199],
      },
    },
    {
      content: sheet.totaleOreStraordinarioFormatted || '0h 00m',
      styles: {
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold',
        fontSize: 8.5,
        textColor: [15, 118, 110],
        fillColor: [204, 251, 241],
      },
    },
    {
      content: sheet.dipendente?.coordinatoreNome ? 'Visto Coord.' : '',
      styles: {
        halign: 'center',
        valign: 'middle',
        fontStyle: 'italic',
        fontSize: 8,
        textColor: [71, 85, 105],
        fillColor: [241, 245, 249],
      },
    },
  ]);

  // Dynamically calculate uniform row height to ensure perfect single-page fit and ordered lines
  const uniformRowHeight = entriesCount > 13 ? 5.8 : entriesCount > 11 ? 6.5 : 7.2;

  autoTable(doc, {
    startY: 51,
    margin: { left: marginX, right: marginX },
    head: tableHeaders,
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      cellPadding: entriesCount > 12 ? 1.4 : 1.8,
      font: 'helvetica',
      minCellHeight: uniformRowHeight,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.35,
      lineColor: [15, 23, 42],
      valign: 'middle',
      minCellHeight: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 26 }, // GIORNO
      1: { cellWidth: 38 }, // ORARIO ORDINARIO
      2: { cellWidth: 38 }, // ORARIO STRAORDINARIO
      3: { cellWidth: 68 }, // MOTIVO DELLO STRAORDINARIO
      4: { cellWidth: 32 }, // N.TOTALE ORE MONTE ORE
      5: { cellWidth: 33 }, // N.TOTALE ORE DI STRAORDINARIO
      6: { cellWidth: 34 }, // FIRMA COORDINATORE PER AUTORIZZAZIONE
    },
  });

  // Footer notes & signature lines - Symmetrically centered & balanced across table width
  const finalY = (doc as any).lastAutoTable?.finalY || 148;
  const pageHeight = 210;
  const tableWidth = pageWidth - marginX * 2; // 269mm
  
  // Exact symmetric centers for the two signature columns (aligned with equal 16mm margins to table outer edges)
  const sigLineWidth = 92;
  const centerCol1 = marginX + 16 + sigLineWidth / 2; // 14 + 16 + 46 = 76mm
  const centerCol2 = pageWidth - marginX - 16 - sigLineWidth / 2; // 283 - 16 - 46 = 221mm

  // Clean vertical cadence with breathing room
  const isCompact = finalY > 156;
  const metaY = Math.max(finalY + 4, isCompact ? 158 : 155);
  const titlesY = metaY + (isCompact ? 6 : 7.5);
  const lineY = titlesY + (isCompact ? 11 : 13.5);
  const captionY = lineY + (isCompact ? 3.5 : 4.5);
  const bottomRuleY = Math.min(pageHeight - 11, Math.max(194, captionY + 5.5));
  const bottomTextY = bottomRuleY + 4;

  // Metadata Row: Left date, Right station perfectly aligned with table bounds
  const todayStr = new Date().toLocaleDateString('it-IT');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Data emissione documento: ${todayStr}`, marginX, metaY);
  doc.text(
    `S.E.T. 118 Taranto · Postazione: ${postazioneStr || 'Taranto Sud'}`,
    pageWidth - marginX,
    metaY,
    { align: 'right' }
  );

  // Column Headers: Centered over their respective signature line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('FIRMA DEL DIPENDENTE', centerCol1, titlesY, { align: 'center' });
  doc.text('FIRMA DEL COORDINATORE S.E.T. 118', centerCol2, titlesY, { align: 'center' });

  // Signature Lines: Symmetrically centered and perfectly horizontal
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.35);
  doc.line(centerCol1 - sigLineWidth / 2, lineY, centerCol1 + sigLineWidth / 2, lineY);
  doc.line(centerCol2 - sigLineWidth / 2, lineY, centerCol2 + sigLineWidth / 2, lineY);

  // Column 1 (Dipendente) content:
  // Strict rules:
  // 1. If document was modified after signing (richiedeNuovaFirma === true): previous signature is invalid. Space above line is left blank, signal new signature required.
  // 2. If valid authorized signature exists: embed original image preserving exact aspect ratio without distortion or cropping.
  // 3. If no signature is provided: leave space above line completely empty. Do NOT invent italic names or substitute symbols.
  if (sheet.richiedeNuovaFirma) {
    // Document modified after signing: previous signature is revoked
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(220, 38, 38);
    doc.text(
      '(Firma decaduta per modifica dati · Richiesta nuova sottoscrizione)',
      centerCol1,
      captionY,
      { align: 'center' }
    );
  } else if (sheet.firmaDipendente) {
    try {
      // Await loading and decoding of authentic image before generating PDF
      const resolvedSig = await resolveSignatureForPdf(sheet.firmaDipendente);
      if (resolvedSig) {
        const maxW = 50;
        const maxH = 13;
        const imgAspect = resolvedSig.aspect || 2.5;

        let renderW = maxW;
        let renderH = maxW / imgAspect;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = maxH * imgAspect;
        }

        doc.addImage(
          resolvedSig.dataUrl,
          resolvedSig.format,
          centerCol1 - renderW / 2,
          lineY - renderH - 1,
          renderW,
          renderH
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(15, 118, 110);
        doc.text(
          `Firma originale autorizzata · ${sheet.firmaDipendente.dataFirma || ''}`,
          centerCol1,
          captionY,
          { align: 'center' }
        );
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('(Firma leggibile dell\'Operatore Soccorritore 118)', centerCol1, captionY, { align: 'center' });
      }
    } catch (e) {
      console.warn('Original signature image could not be loaded; leaving space blank:', e);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('(Firma leggibile dell\'Operatore Soccorritore 118)', centerCol1, captionY, { align: 'center' });
    }
  } else {
    // Unsigned document: leave space above the line completely clean and empty (no fake italic text)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('(Firma leggibile dell\'Operatore Soccorritore 118)', centerCol1, captionY, { align: 'center' });
  }

  // Column 2 (Coordinatore) content:
  // Space above line is left clean and blank for authentic signature by coordinator.
  // Rule: Do NOT invent italic names or substitute symbols.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('(Visto e autorizzazione del Coordinatore del Servizio)', centerCol2, captionY, { align: 'center' });

  // Bottom divider rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(marginX, bottomRuleY, pageWidth - marginX, bottomRuleY);

  // Piè di pagina: 3-way balanced footer (Left, Center, Right)
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('Documento Ufficiale S.E.T. 118', marginX, bottomTextY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Sanitaservice ASL TA s.r.l. Unipersonale · S.E.T. 118 Emergenza Territoriale',
    pageWidth / 2,
    bottomTextY,
    { align: 'center' }
  );
  doc.text(matricolaStr ? `Matr. ${matricolaStr}` : '', pageWidth - marginX, bottomTextY, { align: 'right' });

  return doc;
}

export async function downloadPdf(sheet: MonthlySheet, filename?: string): Promise<void> {
  const doc = await generateOfficialSet118Pdf(sheet);
  const fname =
    filename ||
    `Straordinari_118_${sheet.dipendente?.cognome || 'Dipendente'}_${sheet.id}.pdf`;
  doc.save(fname);
}

export async function getPdfBase64(sheet: MonthlySheet): Promise<string> {
  const doc = await generateOfficialSet118Pdf(sheet);
  const dataUri = doc.output('datauristring');
  // strip data:application/pdf;filename=generated.pdf;base64,
  const base64Index = dataUri.indexOf(';base64,');
  if (base64Index !== -1) {
    return dataUri.substring(base64Index + 8);
  }
  return dataUri;
}
