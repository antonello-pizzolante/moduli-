/**
 * Percorsi pubblici originali degli asset grafici presenti nella cartella public/
 * Rigorosamente NESSUNA immagine codificata in base64.
 * Rigorosamente NESSUN logo/firma generato, ridisegnato o reinterpretato.
 * Include parametro di versione cache-busting (?v=2) per forzare il refresh immediato nel browser.
 */

// Percorsi assoluti pubblici degli asset originali con cache-busting
export const loghiOriginali = '/loghi_originali_pdf.png?v=2';
export const firmaAmministratore = '/firma_pulito.png?v=2';
export const logoSanitaservice = '/sanitaservice_solo_logo.png?v=2';
export const logoAslTaranto = '/asl_taranto_logo.png?v=2';
export const logoSanitaserviceColori = '/sanitaservice_logo_colori.png?v=2';
export const logoSanitaserviceColoriJpeg = '/sanitaservice_logo_colori.jpeg?v=2';
export const logoSanitaserviceJpeg = '/sanitaservice_logo.jpeg?v=2';

// Alias compatibili
export const LOGHI_ORIGINALI_URL = loghiOriginali;
export const FIRMA_PULITO_URL = firmaAmministratore;
export const SANITASERVICE_SOLO_LOGO_URL = logoSanitaservice;
export const ASL_TARANTO_LOGO_URL = logoAslTaranto;
export const SANITASERVICE_LOGO_URL = logoSanitaserviceColori;
