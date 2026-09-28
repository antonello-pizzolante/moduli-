import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  PenTool,
  X,
  RotateCcw,
  Check,
  ShieldCheck,
  FileSignature,
  AlertTriangle,
  Info,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { DigitalSignature, EmployeeProfile } from '../types';
import {
  uploadUserSignature,
  verifySignatureOnline,
  logClientError,
} from '../services/apiService';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (signature: DigitalSignature, saveToProfile: boolean) => void;
  profile: EmployeeProfile;
  existingSignature?: DigitalSignature;
  documentTitle?: string;
  sheetId?: string;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
  profile,
  existingSignature,
  documentTitle = 'Prospetto Ufficiale S.E.T. 118',
  sheetId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<'UPLOAD' | 'DRAW'>('UPLOAD');

  // New signature being drafted/selected
  const [newUploadedDataUrl, setNewUploadedDataUrl] = useState<string | null>(null);
  const [newImageInfo, setNewImageInfo] = useState<{
    fileName: string;
    width: number;
    height: number;
    aspectRatio: number;
    sizeKb: number;
    mimeType: string;
  } | null>(null);

  // Preserve previous signature reference untouched until save succeeds
  const [preservedSignature, setPreservedSignature] = useState<DigitalSignature | undefined>(existingSignature);

  // Status feedback
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<'#0d47a1' | '#0f172a'>('#0d47a1');
  const [penWidth] = useState<number>(2.5);

  // Authorization and persistence options
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const [saveToProfile, setSaveToProfile] = useState<boolean>(true);

  const fullName = `${profile.cognome} ${profile.nome}`.trim() || 'Dipendente S.E.T. 118';

  // Load existing signature on modal open
  useEffect(() => {
    if (!isOpen) return;

    setPreservedSignature(existingSignature);
    setNewUploadedDataUrl(null);
    setNewImageInfo(null);
    setUploadError(null);
    setUploadNotice(null);
    setSaveSuccessMessage(null);
    setIsSaving(false);
    setHasDrawn(false);

    if (existingSignature?.tipo === 'DISEGNO' && !existingSignature?.dataUrl?.startsWith('data:image/')) {
      setMode('DRAW');
    } else {
      setMode('UPLOAD');
    }
  }, [isOpen, existingSignature]);

  // Setup drawing canvas when in DRAW mode
  useEffect(() => {
    if (!isOpen || mode !== 'DRAW') return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;

      // Draw baseline guideline
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(20, rect.height - 24);
      ctx.lineTo(rect.width - 20, rect.height - 24);
      ctx.stroke();
      ctx.restore();

      // If we have an existing drawing, restore it onto the canvas
      if (preservedSignature?.dataUrl && preservedSignature.tipo === 'DISEGNO' && !hasDrawn) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasDrawn(true);
        };
        img.src = preservedSignature.dataUrl;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, mode, penColor, penWidth]);

  if (!isOpen) return null;

  // Handle authentic image file upload (PNG, JPEG, JPG, WebP)
  const processImageFile = (file: File) => {
    setUploadError(null);
    setUploadNotice(null);
    setSaveSuccessMessage(null);

    // Validate MIME type and file extension
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isSupportedMime = file.type.match(/^image\/(png|jpeg|jpg|webp)$/i);
    const isSupportedExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    if (!isSupportedMime && !isSupportedExt) {
      setUploadError('Formato non supportato. Carica esclusivamente file immagine autentici PNG o JPG/JPEG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`Il file selezionato supera i 5MB (${(file.size / (1024 * 1024)).toFixed(2)} MB). Carica una scansione o ritaglio a risoluzione ottimale (max 5MB).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setUploadError('Impossibile leggere il file immagine originale.');
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < 30 || img.naturalHeight < 15) {
          setUploadError('La risoluzione dell\'immagine è troppo bassa (inferiore a 30×15 px). Carica una scansione leggibile.');
          return;
        }

        const mime = file.type || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png');
        setNewUploadedDataUrl(result);
        setNewImageInfo({
          fileName: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: Number((img.naturalWidth / img.naturalHeight).toFixed(2)),
          sizeKb,
          mimeType: mime,
        });
        setUploadNotice(`File autentico "${file.name}" caricato correttamente in anteprima (${img.naturalWidth}×${img.naturalHeight} px, ${sizeKb} KB).`);
      };

      img.onerror = () => {
        setUploadError('Immagine danneggiata o illeggibile. Assicurati che il file sia un PNG o JPG valido.');
      };

      img.src = result;
    };

    reader.onerror = () => {
      setUploadError('Errore durante la lettura del file dal dispositivo.');
    };

    reader.readAsDataURL(file);

    // Reset input so selecting the same file again triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleCancelNewUpload = () => {
    setNewUploadedDataUrl(null);
    setNewImageInfo(null);
    setUploadError(null);
    setUploadNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    setUploadNotice(null);
    setUploadError(null);

    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);

    // Redraw baseline guide
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 24);
    ctx.lineTo(rect.width - 20, rect.height - 24);
    ctx.stroke();
    ctx.restore();
  };

  // Confirm and persist signature to authentic server archive
  const handleConfirmSignature = async () => {
    if (!isAuthorized) {
      alert('È necessario spuntare la casella di autorizzazione espressa prima di procedere.');
      return;
    }

    setUploadError(null);
    setSaveSuccessMessage(null);

    let base64DataToSend = '';
    let fileNameToSend = '';
    let mimeTypeToSend = 'image/png';
    let tipoToSend: 'ORIGINALE' | 'DISEGNO' = 'ORIGINALE';
    let widthToSend = 0;
    let heightToSend = 0;

    if (mode === 'UPLOAD') {
      if (newUploadedDataUrl && newImageInfo) {
        base64DataToSend = newUploadedDataUrl;
        fileNameToSend = newImageInfo.fileName;
        mimeTypeToSend = newImageInfo.mimeType;
        tipoToSend = 'ORIGINALE';
        widthToSend = newImageInfo.width;
        heightToSend = newImageInfo.height;
      } else if (preservedSignature?.dataUrl) {
        // Confirming the existing preserved signature
        base64DataToSend = preservedSignature.dataUrl;
        fileNameToSend = preservedSignature.fileName || `firma_${profile.matricola}.png`;
        mimeTypeToSend = 'image/png';
        tipoToSend = preservedSignature.tipo === 'DISEGNO' ? 'DISEGNO' : 'ORIGINALE';
        widthToSend = preservedSignature.originalWidth || 0;
        heightToSend = preservedSignature.originalHeight || 0;
      } else {
        setUploadError('Seleziona prima un file immagine originale della firma.');
        return;
      }
    } else {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        setUploadError('Traccia la tua firma sulla tavoletta prima di salvare.');
        return;
      }
      base64DataToSend = canvas.toDataURL('image/png');
      fileNameToSend = `firma_autografa_${profile.matricola}.png`;
      mimeTypeToSend = 'image/png';
      tipoToSend = 'DISEGNO';
      widthToSend = canvas.width;
      heightToSend = canvas.height;
    }

    setIsSaving(true);

    try {
      // 1. Invio e salvataggio sul server
      const result = await uploadUserSignature({
        base64Data: base64DataToSend,
        fileName: fileNameToSend,
        mimeType: mimeTypeToSend,
        tipo: tipoToSend,
        width: widthToSend,
        height: heightToSend,
        sheetId: sheetId,
      });

      if (!result.success || !result.signature) {
        throw new Error(result.message || 'Salvataggio non riuscito sul server.');
      }

      // 2. Rilettura e convalida online per garantire la persistenza reale
      const verifiedOnline = await verifySignatureOnline();
      if (!verifiedOnline.success || !verifiedOnline.signature) {
        throw new Error('Verifica online non riuscita: la firma non è stata riletta dal server. Riprova.');
      }

      // 3. Mostra "Firma salvata" solo dopo che file e riferimento sono stati salvati e riletti con successo
      setSaveSuccessMessage('Firma salvata e convalidata con successo nel profilo.');

      // Aggiorna componente genitore
      onSaveSignature(verifiedOnline.signature, saveToProfile);

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Signature upload error:', err);
      setIsSaving(false);
      setUploadError(err.message || 'Impossibile completare il salvataggio della firma. La firma precedente è rimasta valida.');
      logClientError('FIRMA', err.message || 'Errore salvataggio firma', { matricola: profile.matricola });
      // Preserved signature remains intact!
    }
  };

  const hasNewUpload = Boolean(newUploadedDataUrl);
  const hasValidPreserved = Boolean(preservedSignature?.dataUrl);
  const isConfirmDisabled =
    isSaving ||
    !isAuthorized ||
    Boolean(saveSuccessMessage) ||
    (mode === 'UPLOAD' && !hasNewUpload && !hasValidPreserved) ||
    (mode === 'DRAW' && !hasDrawn && !hasValidPreserved);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <FileSignature className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                Firma Autentica · {fullName}
              </h2>
              <p className="text-xs text-slate-300">
                {documentTitle} · Matr. {profile.matricola}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Real Save Confirmation Message Banner */}
          {saveSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border-2 border-emerald-500 rounded-xl text-xs text-emerald-900 dark:text-emerald-100 flex items-center gap-3 animate-in fade-in duration-200 shadow-md">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">
                  Firma salvata correttamente!
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  {saveSuccessMessage} Il documento PDF è stato aggiornato con il nuovo riferimento.
                </p>
              </div>
            </div>
          )}

          {/* Immediate Error Message Banner */}
          {uploadError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Attenzione durante il caricamento della firma:</p>
                <p>{uploadError}</p>
              </div>
            </div>
          )}

          {/* Immediate Success Notice upon file reading */}
          {uploadNotice && !saveSuccessMessage && (
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-200 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="font-medium text-[11px]">{uploadNotice}</span>
            </div>
          )}

          {/* Strict compliance notice */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed text-[11px]">
              <span className="font-bold text-slate-900 dark:text-white">
                Fedeltà e Autenticità della Firma Originale:
              </span>
              <p>
                La firma viene archiviata nel tuo archivio privato con codice hash SHA-256 e integrata nel PDF preservando proporzioni e trasparenza originali, senza alterazioni grafiche.
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('UPLOAD')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'UPLOAD'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Carica File (PNG / JPG)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('DRAW')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'DRAW'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Traccia a Mano Libera</span>
            </button>
          </div>

          {/* MODE 1: UPLOAD FILE */}
          {mode === 'UPLOAD' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
                id="signatureFileInput"
              />

              {/* Case A: New file selected and loaded in preview */}
              {newUploadedDataUrl && newImageInfo ? (
                <div className="space-y-2 animate-in fade-in">
                  <div className="p-3 bg-white dark:bg-slate-900 border-2 border-teal-500/80 rounded-xl shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                          {newImageInfo.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({newImageInfo.width}×{newImageInfo.height} px · {newImageInfo.sizeKb} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-teal-600 hover:text-teal-700 text-xs font-semibold cursor-pointer"
                        >
                          Cambia
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={handleCancelNewUpload}
                          className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 cursor-pointer"
                          title="Annulla selezione"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Annulla</span>
                        </button>
                      </div>
                    </div>

                    {/* Preview box with checkerboard background for transparency checking */}
                    <div className="h-32 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] bg-[size:10px_10px] overflow-hidden">
                      <img
                        src={newUploadedDataUrl}
                        alt="Anteprima nuova firma caricata"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-teal-700 dark:text-teal-300 font-medium text-center">
                    ✓ Nuova firma pronta: premi &ldquo;Apponi Firma Autorizzata&rdquo; sotto per confermare il salvataggio persistente.
                  </p>
                </div>
              ) : (
                /* Case B: No new file chosen yet. Show upload dropzone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-teal-400/60 dark:border-teal-700 hover:border-teal-500 rounded-xl p-6 text-center cursor-pointer bg-teal-50/20 dark:bg-slate-800/40 hover:bg-teal-50/40 transition-colors flex flex-col items-center justify-center space-y-2 group"
                >
                  <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                    <Upload className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Carica o trascina la tua firma originale (PNG o JPG/JPEG)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Scansione o ritaglio su sfondo trasparente o bianco (fino a 5MB)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-100/80 dark:bg-teal-950 px-3 py-1.5 rounded-lg border border-teal-300 dark:border-teal-800 mt-2 shadow-2xs">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Sfoglia file dal dispositivo
                  </span>
                </div>
              )}

              {/* Display preserved signature if available, giving user reassurance */}
              {preservedSignature?.dataUrl && !newUploadedDataUrl && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-200/80 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>Firma attualmente registrata nel profilo:</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {preservedSignature.dataFirma}
                    </span>
                  </div>
                  <div className="h-16 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5">
                    <img
                      src={preservedSignature.dataUrl}
                      alt="Firma attualmente attiva"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 italic text-center">
                    La firma attuale rimarrà conservata e valida finché non carichi e confermi una nuova immagine.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: DRAW ON SCREEN */}
          {mode === 'DRAW' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Traccia la firma autentica a mano libera nel riquadro:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPenColor('#0d47a1')}
                    title="Inchiostro Blu Istituzionale"
                    className={`w-5 h-5 rounded-full bg-[#0d47a1] border-2 transition-transform cursor-pointer ${
                      penColor === '#0d47a1' ? 'scale-115 border-rose-500 shadow-xs' : 'border-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor('#0f172a')}
                    title="Inchiostro Nero"
                    className={`w-5 h-5 rounded-full bg-[#0f172a] border-2 transition-transform cursor-pointer ${
                      penColor === '#0f172a' ? 'scale-115 border-rose-500 shadow-xs' : 'border-white'
                    }`}
                  />
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer font-medium text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Pulisci
                  </button>
                </div>
              </div>

              {/* Drawing pad box */}
              <div className="relative border-2 border-slate-300 dark:border-slate-700 rounded-xl bg-white overflow-hidden shadow-inner touch-none">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ touchAction: 'none' }}
                  className="w-full h-36 cursor-crosshair block"
                />
                <div className="absolute bottom-2 left-4 text-[10px] text-slate-400 font-mono pointer-events-none select-none">
                  Firma: {fullName} · Matr. {profile.matricola}
                </div>
              </div>
            </div>
          )}

          {/* Legal Notice on Document Modifications & Digital Signatures */}
          <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed text-[11px]">
              <span className="font-bold">Effetto delle modifiche sui documenti firmati:</span>
              <p>
                Qualora il foglio o i dati dei turni vengano modificati in seguito, la firma sul documento decadrà automaticamente per ragioni di conformità. Potrai rinnovarla con un solo clic.
              </p>
            </div>
          </div>

          {/* Checkboxes: Explicit Authorization & Profile Save */}
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="authCheck"
                checked={isAuthorized}
                onChange={(e) => setIsAuthorized(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 mt-0.5 cursor-pointer"
              />
              <label
                htmlFor="authCheck"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none leading-snug"
              >
                Autorizzo espressamente l&apos;archiviazione e l&apos;apposizione della mia firma autentica su questo documento.
              </label>
            </div>

            <div className="flex items-center gap-2 pl-6">
              <input
                type="checkbox"
                id="saveProfileSig"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <label
                htmlFor="saveProfileSig"
                className="text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none"
              >
                Salva come firma predefinita nel profilo personale per i prossimi documenti
              </label>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={handleConfirmSignature}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white rounded-lg transition-all shadow-sm ${
              isConfirmDisabled
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-teal-600 hover:bg-teal-700 active:scale-98 cursor-pointer'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Salvataggio in corso...</span>
              </>
            ) : saveSuccessMessage ? (
              <>
                <Check className="w-4 h-4" />
                <span>Firma salvata</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Salva firma</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
