import jsPDF from 'jspdf';
import { CambioTurnoData, PermessiTimbraturaData, DigitalSignature } from '../types';
import { loghiOriginali, firmaAmministratore } from '../assets/originalAssets';
import { loadOriginalPublicImage } from './imageLoader';

async function resolveSignatureForPdf(sig?: DigitalSignature): Promise<{
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  aspect: number;
} | null> {
  if (!sig) return null;

  let base64 = sig.dataUrl;

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
      console.warn('Could not fetch signature image in pdfFormGenerators:', e);
    }
  }

  if (!base64 || !base64.startsWith('data:image/')) return null;

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

// Helper to draw circle/bullet
function drawBullet(doc: jsPDF, x: number, y: number, filled: boolean = true) {
  doc.setFillColor(30, 41, 59);
  doc.circle(x, y - 1, 1.3, filled ? 'F' : 'S');
}

// Helper to draw radio circle
function drawRadioCircle(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.35);
  doc.circle(x, y - 1, 1.8, 'S');
  if (checked) {
    doc.setFillColor(30, 41, 59);
    doc.circle(x, y - 1, 1.1, 'F');
  }
}

/**
 * 1. Generatore PDF Ufficiale: MODELLO PER CAMBI TURNO
 * Riproduzione fedele 1:1 del documento aziendale Sanitaservice ASL TA
 */
export async function generateCambioTurnoPdf(data: CambioTurnoData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 20;

  // Header Logo: Sanitaservice ASL TA & PugliaSalute (original authentic banner)
  // Loaded directly from public file: const loghiOriginali = "/loghi_originali_pdf.png";
  // Preserving original proportions, colors, quality and transparency with contain calculation.
  try {
    const logoImg = await loadOriginalPublicImage(loghiOriginali);
    const aspect = logoImg.aspect;
    const maxW = 85;
    const maxH = 15;
    let renderW = maxW;
    let renderH = maxW / aspect;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = maxH * aspect;
    }
    doc.addImage(logoImg.data, logoImg.format, marginX, 12, renderW, renderH);
  } catch (err) {
    console.warn('Original Sanitaservice/ASL Taranto logo could not be embedded; leaving space blank:', err);
  }

  // Taranto _________
  const yTaranto = 50;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const dataRichiestaFormatted = data.dataRichiesta || '';
  doc.text(`Taranto ${dataRichiestaFormatted ? dataRichiestaFormatted : '________'}`, marginX, yTaranto);

  // Postazione & Matricola N° (campo obbligatorio)
  const yMeta = 60;
  doc.text('Postazione ', marginX, yMeta);
  doc.setFont('helvetica', 'bold');
  doc.text(data.postazione || '____________________', marginX + 24, yMeta);
  doc.line(marginX + 23, yMeta + 1, marginX + 80, yMeta + 1);

  // Right: Matr. N°
  const xMatr = 135;
  doc.setFont('helvetica', 'normal');
  doc.text('Matr. N° ', xMatr, yMeta);
  doc.setFont('helvetica', 'bold');
  doc.text(data.matricolaRichiedente || '____________', xMatr + 18, yMeta);
  doc.line(xMatr + 17, yMeta + 1, pageWidth - marginX, yMeta + 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('(campo obbligatorio)', xMatr + 14, yMeta + 5.5);

  // Title: Modello per CAMBI TURNO
  const yTitle = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Modello per CAMBI TURNO', pageWidth / 2, yTitle, { align: 'center' });

  // Body content
  let y = 92;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  // o Cambio turno tra colleghi
  drawRadioCircle(doc, marginX + 12, y, true);
  doc.text('Cambio turno tra colleghi', marginX + 18, y);

  y += 14;
  doc.text('Il cambio turno è richiesto', marginX + 18, y);
  y += 8;
  doc.text('da:', marginX + 18, y);

  y += 14;
  drawRadioCircle(doc, marginX + 12, y, true);
  doc.text('Collega', marginX + 18, y);

  y += 14;
  const richiedenteNome = data.nomeRichiedente || '____________________________________________';
  doc.text('Il/la sottoscritto/a', marginX + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text(richiedenteNome, marginX + 54, y);
  doc.line(marginX + 53, y + 1, marginX + 145, y + 1);

  doc.setFont('helvetica', 'normal');
  doc.text('chiede e', marginX + 148, y);

  y += 10;
  const accettanteNome = data.collegaAccettante || '____________________________________________________';
  doc.text('concorda con', marginX + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text(accettanteNome, marginX + 46, y);
  doc.line(marginX + 45, y + 1, marginX + 145, y + 1);

  y += 14;
  const isAutista = data.qualifica === 'AUTISTA_SOCCORRITORE';
  drawRadioCircle(doc, marginX + 12, y, isAutista);
  doc.setFont('helvetica', isAutista ? 'bold' : 'normal');
  doc.text('AUTISTA- SOCCORRITORE', marginX + 18, y);

  y += 8;
  const isSoccorritore = data.qualifica === 'SOCCORRITORE';
  drawRadioCircle(doc, marginX + 12, y, isSoccorritore);
  doc.setFont('helvetica', isSoccorritore ? 'bold' : 'normal');
  doc.text('SOCCORRITORE', marginX + 18, y);

  // Turni
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text('Il richiedente effettuerà turno ore', marginX + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.turnoRichiedenteInizio || '__________', marginX + 85, y);
  doc.setFont('helvetica', 'normal');
  doc.text('-', marginX + 110, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.turnoRichiedenteFine || '__________', marginX + 116, y);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.text('L’accettante effettuerà turno ore', marginX + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.turnoAccettanteInizio || '__________', marginX + 85, y);
  doc.setFont('helvetica', 'normal');
  doc.text('-', marginX + 110, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.turnoAccettanteFine || '__________', marginX + 116, y);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.text('nel giorno', marginX + 18, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.giornoCambio || '____________________', marginX + 40, y);

  // Signature Block
  const yFirme = 205;
  const xFirma = 95;

  doc.setFont('helvetica', 'normal');
  doc.text('L’operatore richiedente', xFirma, yFirme);
  doc.line(xFirma, yFirme + 8, xFirma + 65, yFirme + 8);

  // If user has explicitly authorized their signature on this sheet, embed original image preserving aspect ratio
  if (data.firmaRichiedenteAutorizzata && data.firmaRichiedente) {
    try {
      const resolved = await resolveSignatureForPdf(data.firmaRichiedente);
      if (resolved) {
        const maxW = 44;
        const maxH = 11;
        const imgAspect = resolved.aspect || 2.5;

        let renderW = maxW;
        let renderH = maxW / imgAspect;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = maxH * imgAspect;
        }

        doc.addImage(
          resolved.dataUrl,
          resolved.format,
          xFirma + (65 - renderW) / 2,
          yFirme + 8 - renderH - 1,
          renderW,
          renderH
        );
      }
    } catch (e) {
      console.warn('Could not embed original signature in cambio turno PDF; leaving space blank:', e);
    }
  }

  // L'operatore accettante: leave space above line clean and blank for authentic signature
  doc.text('L’operatore accettante', xFirma, yFirme + 18);
  doc.line(xFirma, yFirme + 26, xFirma + 65, yFirme + 26);

  // Il referente: leave space above line clean and blank for authentic signature
  doc.text('Il referente', marginX + 18, yFirme + 32);
  doc.line(marginX + 18, yFirme + 40, marginX + 85, yFirme + 40);

  // Official Footer (reproduced 1:1)
  const yFooter = 265;
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.4);
  doc.line(marginX, yFooter, pageWidth - marginX, yFooter);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 50, 60);

  doc.text(
    'Società soggetta a direzione e coordinamento da parte dell’ASL TARANTO ai sensi dell’art. 2497 e ss. Codice Civile',
    pageWidth / 2,
    yFooter + 4.5,
    { align: 'center' }
  );
  doc.text(
    'Sede Legale: Viale Virgilio, 31 – 74123 Taranto - Sede Operativa: Via Duca di Genova 63/A – 74123 Taranto',
    pageWidth / 2,
    yFooter + 8.5,
    { align: 'center' }
  );
  doc.text(
    'Tel: 0994585171 – 0994585173 Fax: 0994585172 - C.F./P. IVA 02775310739',
    pageWidth / 2,
    yFooter + 12.5,
    { align: 'center' }
  );
  doc.text(
    'e-mail: sanitaservice@asl.taranto.it - P.E.C.: sanitaserviceaslta@pec.it – www.housejonicaservice.it',
    pageWidth / 2,
    yFooter + 16.5,
    { align: 'center' }
  );

  return doc;
}

/**
 * 2. Generatore PDF Ufficiale: MODULO PERMESSI & MANCATA TIMBRATURA
 * (Richiesta Autorizzazione ad assentarsi dal servizio / Mancata timbratura)
 * Riproduzione fedele 1:1 del documento aziendale Sanitaservice ASL TA & PugliaSalute
 */
export async function generatePermessiTimbraturaPdf(data: PermessiTimbraturaData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 20;

  // Header Logo: Sanitaservice ASL TA & PugliaSalute (original authentic banner)
  // Loaded directly from public file: const loghiOriginali = "/loghi_originali_pdf.png";
  // Preserving original proportions, colors, quality and transparency with contain calculation.
  try {
    const logoImg = await loadOriginalPublicImage(loghiOriginali);
    const aspect = logoImg.aspect;
    const maxW = 85;
    const maxH = 15;
    let renderW = maxW;
    let renderH = maxW / aspect;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = maxH * aspect;
    }
    doc.addImage(logoImg.data, logoImg.format, marginX, 12, renderW, renderH);
  } catch (err) {
    console.warn('Original Sanitaservice/ASL Taranto logo could not be embedded; leaving space blank:', err);
  }

  // Matr. N° (campo obbligatorio)
  const yMatr = 44;
  const xMatr = 120;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Matr. N° ', xMatr, yMatr);
  doc.setFont('helvetica', 'bold');
  doc.text(data.matricola || '____________________', xMatr + 20, yMatr);
  doc.line(xMatr + 19, yMatr + 1, pageWidth - marginX - 10, yMatr + 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('(campo obbligatorio)', xMatr + 20, yMatr + 5.5);

  // Taranto lì
  const yTaranto = 56;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Taranto lì ', marginX, yTaranto);
  doc.text(data.dataRichiesta || '____________________', marginX + 22, yTaranto);
  doc.line(marginX + 21, yTaranto + 1, marginX + 68, yTaranto + 1);

  // POSTAZIONE
  const yPostazione = 65;
  doc.setFont('helvetica', 'bold');
  doc.text('POSTAZIONE: ', marginX, yPostazione);
  doc.text(data.postazione || '____________________', marginX + 33, yPostazione);
  doc.line(marginX + 32, yPostazione + 1, marginX + 90, yPostazione + 1);

  // Il/la sottoscritto/a ... in qualità di dipendente
  const yPremessa = 76;
  doc.setFont('helvetica', 'normal');
  doc.text('Il/la    sottoscritto/a', marginX, yPremessa);
  doc.setFont('helvetica', 'bold');
  const nomeStr = data.nomeCognome || '________________________________________';
  doc.text(nomeStr, marginX + 42, yPremessa);
  doc.line(marginX + 41, yPremessa + 1, marginX + 130, yPremessa + 1);

  doc.setFont('helvetica', 'bold');
  doc.text('in   qualità di dipendente', marginX + 132, yPremessa);

  doc.text('Sanitaservice Asl Ta Srl Unipersonale', marginX + 15, yPremessa + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('chiede l’autorizzazione ad assentarsi dal servizio per:', marginX, yPremessa + 18);

  // Options list with dots (•)
  let y = 104;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  // 1. Ferie
  drawBullet(doc, marginX + 2, y, data.richiestaFerie);
  doc.setFont('helvetica', data.richiestaFerie ? 'bold' : 'normal');
  doc.text('richiesta ferie (o giorni) dal', marginX + 7, y);
  doc.text(data.ferieDal || '________________', marginX + 62, y);
  doc.text('al', marginX + 96, y);
  doc.text(data.ferieAl || '________________', marginX + 102, y);

  // 2. Congedo maternità/paternità
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.richiestaCongedo);
  doc.setFont('helvetica', data.richiestaCongedo ? 'bold' : 'normal');
  doc.text('richiesta congedo maternità/paternità dal', marginX + 7, y);
  doc.text(data.congedoDal || '____________', marginX + 83, y);
  doc.text('al', marginX + 110, y);
  doc.text(data.congedoAl || '____________', marginX + 116, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('(allegare documentazione)', marginX + 142, y);
  doc.setFontSize(10);

  // 3. Recupero festività
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.recuperoFestivita);
  doc.setFont('helvetica', data.recuperoFestivita ? 'bold' : 'normal');
  doc.text('recupero festività (del', marginX + 7, y);
  doc.text(data.festivitaDel || '________________________', marginX + 48, y);
  doc.text(') il', marginX + 97, y);
  doc.text(data.recuperoFestivitaIl || '________________________', marginX + 104, y);

  // 4. Permesso personale
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.permessoPersonale);
  doc.setFont('helvetica', data.permessoPersonale ? 'bold' : 'normal');
  doc.text('permesso personale il', marginX + 7, y);
  doc.text(data.permessoPersonaleIl || '________________________', marginX + 51, y);

  // 5. Permesso lutto
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.permessoLutto);
  doc.setFont('helvetica', data.permessoLutto ? 'bold' : 'normal');
  doc.text('permesso lutto dal', marginX + 7, y);
  doc.text(data.luttoDal || '________________', marginX + 45, y);
  doc.text('al', marginX + 80, y);
  doc.text(data.luttoAl || '________________', marginX + 86, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('(allegare certificazione)', marginX + 125, y);
  doc.setFontSize(10);

  // 6. Recupero permesso personale
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.recuperoPermessoPersonale);
  doc.setFont('helvetica', data.recuperoPermessoPersonale ? 'bold' : 'normal');
  doc.text('recupero permesso personale del', marginX + 7, y);
  doc.text(data.recuperoPermessoDel || '________________', marginX + 71, y);
  doc.text('il', marginX + 108, y);
  doc.text(data.recuperoPermessoIl || '________________', marginX + 113, y);

  // 7. Legge 104
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.permessoLegge104);
  doc.setFont('helvetica', data.permessoLegge104 ? 'bold' : 'normal');
  doc.text('permesso legge 104 nei gg.', marginX + 7, y);
  doc.text(data.legge104Giorni || '________________________________________________', marginX + 60, y);

  // 8. Permesso retribuito art. 34
  y += 8.5;
  drawBullet(doc, marginX + 2, y, data.permessoArt34);
  doc.setFont('helvetica', data.permessoArt34 ? 'bold' : 'normal');
  doc.text('permesso retribuito art. 34', marginX + 7, y);
  doc.text(data.art34Dettagli || '________________________________________', marginX + 59, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('(allegare documentazione)', marginX + 110, y);
  doc.setFontSize(10);

  // 9. Dichiara di esser stato presente al lavoro e di aver omesso la timbratura
  y += 11;
  drawBullet(doc, marginX + 2, y, data.mancataTimbratura);
  doc.setFont('helvetica', 'bold');
  doc.text('dichiara di esser stato presente al lavoro e di aver omesso la timbratura :', marginX + 7, y);

  y += 7.5;
  drawBullet(doc, marginX + 10, y, data.omessaEntrata);
  doc.setFont('helvetica', data.omessaEntrata ? 'bold' : 'normal');
  doc.text('in entrata alle ore', marginX + 16, y);
  doc.text(data.omessaEntrataOra || '____.____', marginX + 50, y);
  doc.text('del', marginX + 73, y);
  doc.text(data.omessaEntrataData || '________________________', marginX + 80, y);

  y += 7.5;
  drawBullet(doc, marginX + 10, y, data.omessaUscita);
  doc.setFont('helvetica', data.omessaUscita ? 'bold' : 'normal');
  doc.text('in uscita alle ore', marginX + 16, y);
  doc.text(data.omessaUscitaOra || '____.____', marginX + 48, y);
  doc.text('del', marginX + 73, y);
  doc.text(data.omessaUscitaData || '________________________', marginX + 80, y);

  // Motivo
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.text('per il seguente motivo', marginX, y);
  doc.setFont('helvetica', 'bold');
  const motivo1 = data.motivoMancataTimbratura ? data.motivoMancataTimbratura.slice(0, 55) : '';
  const motivo2 = data.motivoMancataTimbratura ? data.motivoMancataTimbratura.slice(55, 120) : '';

  doc.text(motivo1 || '____________________________________________________________________', marginX + 41, y);
  doc.line(marginX + 40, y + 1, pageWidth - marginX, y + 1);

  y += 8;
  doc.text(motivo2 || '____________________________________________________________________________________________', marginX, y);
  doc.line(marginX, y + 1, pageWidth - marginX, y + 1);

  // Signatures
  const yFirme = 214;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Firma del dipendente', marginX, yFirme);

  // Applicant signature: embed original image preserving aspect ratio only if authorized
  if (data.firmaDipendenteAutorizzata && data.firmaDipendente) {
    try {
      const resolved = await resolveSignatureForPdf(data.firmaDipendente);
      if (resolved) {
        const maxW = 48;
        const maxH = 12;
        const imgAspect = resolved.aspect || 2.5;

        let renderW = maxW;
        let renderH = maxW / imgAspect;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = maxH * imgAspect;
        }

        doc.addImage(
          resolved.dataUrl,
          resolved.format,
          marginX + (60 - renderW) / 2,
          yFirme + 16 - renderH - 1,
          renderW,
          renderH
        );
      }
    } catch (e) {
      console.warn('Could not embed original signature in permessi PDF; leaving space blank:', e);
    }
  }
  doc.line(marginX, yFirme + 16, marginX + 60, yFirme + 16);

  // Admin signature on the right:
  // Using original raster asset for Dr. Giuseppe Pulito loaded from public: const firmaAmministratore = "/firma_pulito.png";
  // Preserving exact aspect ratio, raster resolution, colors, without vectorization or filters.
  const xAdmin = 130;
  const adminColWidth = pageWidth - marginX - xAdmin;
  try {
    const firmaImg = await loadOriginalPublicImage(firmaAmministratore);
    const aspect = firmaImg.aspect;
    const maxW = 52;
    const maxH = 22;
    let renderW = maxW;
    let renderH = maxW / aspect;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = maxH * aspect;
    }
    const xPos = xAdmin + (adminColWidth - renderW) / 2;
    doc.addImage(firmaImg.data, firmaImg.format, xPos, yFirme, renderW, renderH);
  } catch (e) {
    console.warn('Original signature image could not be embedded; leaving space blank:', e);
  }
  doc.line(xAdmin - 5, yFirme + 24, pageWidth - marginX, yFirme + 24);

  // Official Footer
  const yFooter = 265;
  doc.setDrawColor(180, 190, 200);
  doc.setLineWidth(0.4);
  doc.line(marginX, yFooter, pageWidth - marginX, yFooter);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40, 50, 60);

  doc.text(
    'Società soggetta a direzione e coordinamento da parte dell’ASL TARANTO ai sensi dell’art. 2497 e ss. Codice Civile',
    pageWidth / 2,
    yFooter + 4,
    { align: 'center' }
  );
  doc.text(
    'www.sanitaserviceaslta.it - C.F./P.IVA 02775310739 -',
    pageWidth / 2,
    yFooter + 8,
    { align: 'center' }
  );

  // Left & Right contact details
  doc.text('sanitaservice@asl.taranto.it', marginX + 45, yFooter + 12);
  doc.text('sanitaserviceaslta@pec.it', marginX + 45, yFooter + 15.5);

  doc.text('Sede Legale: Viale Virgilio, 31 – 74123 Taranto', marginX + 95, yFooter + 12);
  doc.text('Sede Operativa: Via Duca di Genova 63/A – 74123 Taranto', marginX + 95, yFooter + 15.5);

  return doc;
}
