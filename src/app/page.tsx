'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, Settings, Plus, Trash2, User, ImagePlus, Camera, Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ═══════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════ */
interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  photo: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  { id: '1', name: 'Maria', phone: '', relation: 'Hija', photo: '' },
  { id: '2', name: 'Carlos', phone: '', relation: 'Hijo', photo: '' },
  { id: '3', name: 'Ana', phone: '', relation: 'Nieta', photo: '' },
];

const AVATAR_COLORS = [
  'bg-orange-400', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500',
];

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */
function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  try {
    const saved = localStorage.getItem('mis-queridos-contacts');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return DEFAULT_CONTACTS;
}

function saveToStorage(contacts: Contact[]) {
  try {
    localStorage.setItem('mis-queridos-contacts', JSON.stringify(contacts));
    return true;
  } catch {
    // localStorage full - try removing photos and saving without them
    try {
      const light = contacts.map(c => ({ ...c, photo: '' }));
      localStorage.setItem('mis-queridos-contacts', JSON.stringify(light));
    } catch { /* give up */ }
    return false;
  }
}

function getAvatarColor(id: string) {
  return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length];
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

// Remove accents and lowercase
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Resize image to save localStorage space (max ~50KB per image)
function resizeImage(file: File, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo cargar imagen'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxPx) { h = (h * maxPx) / w; w = maxPx; } }
        else { if (h > maxPx) { w = (w * maxPx) / h; h = maxPx; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Fuzzy match: returns true if spoken text contains the contact name
// Works even if the person says "Adriana" and contact is "Ana"
function voiceMatchesContact(spoken: string, contactName: string): boolean {
  const spokenNorm = normalize(spoken);
  const nameNorm = normalize(contactName);

  // Exact contains
  if (spokenNorm.includes(nameNorm)) return true;

  // Check if the name is a substring start of any word in spoken text
  const words = spokenNorm.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(nameNorm) || nameNorm.startsWith(word)) return true;
    // Levenshtein distance <= 2 for short names
    if (nameNorm.length <= 8 && levenshtein(word, nameNorm) <= 2) return true;
  }

  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [showSettings, setShowSettings] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'checking' | 'supported' | 'not_supported' | 'denied'>('checking');
  const { toast } = useToast();

  // Voice state
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const recognitionRef = useRef<any>(null);
  const contactsRef = useRef<Contact[]>(contacts);
  const onMatchRef = useRef<(c: Contact) => void>(() => {});
  const isStartingRef = useRef(false);

  // Photo input refs - REAL inputs in DOM (mobile requires this)
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string>('');

  // Voice call overlay
  const [pendingCall, setPendingCall] = useState<Contact | null>(null);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  // Keep contacts ref in sync
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  const saveContacts = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts);
    const ok = saveToStorage(newContacts);
    if (!ok) {
      toast({ title: 'Memoria llena', description: 'Se guardaron los datos pero sin fotos.', variant: 'destructive' });
    }
  }, [toast]);

  /* ── Call logic: direct tel: link (no JS tricks) ── */
  const getTelHref = useCallback((contact: Contact): string => {
    if (!contact.phone) return '';
    return `tel:${contact.phone.replace(/[^\d+]/g, '')}`;
  }, []);

  const handleNoPhone = useCallback((contact: Contact) => {
    toast({
      title: 'Sin numero',
      description: `Configura el numero de ${contact.name} primero.`,
      variant: 'destructive',
    });
  }, [toast]);

  /* ── Voice call confirmation ── */
  const handleVoiceMatch = useCallback((contact: Contact) => {
    setPendingCall(contact);
    setCountdown(3);
  }, []);

  const cancelVoiceCall = useCallback(() => {
    clearInterval(countdownRef.current);
    setPendingCall(null);
  }, []);

  useEffect(() => {
    if (!pendingCall) return;
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          const c = pendingCall;
          setPendingCall(null);
          // Direct call via tel: href
          window.location.href = `tel:${c.phone.replace(/[^\d+]/g, '')}`;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [pendingCall]);

  /* ── Speech Recognition ── */
  // Check support once on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus('not_supported');
      return;
    }
    setVoiceStatus('supported');
  }, []);

  // Start/stop recognition when voiceEnabled changes
  useEffect(() => {
    if (voiceStatus !== 'supported') return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    onMatchRef.current = handleVoiceMatch;

    if (!voiceEnabled) {
      try { recognitionRef.current?.stop(); } catch { /* */ }
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'es-ES';
    recognition.maxAlternatives = 5;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const transcript = result[0].transcript.trim();
        setLastHeard(transcript);

        for (const contact of contactsRef.current) {
          if (!contact.phone) continue;
          if (voiceMatchesContact(transcript, contact.name)) {
            onMatchRef.current(contact);
            return;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.log('Voice error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setListening(false);
        setVoiceEnabled(false);
        setVoiceStatus('denied');
        toast({
          title: 'Microfono no permitido',
          description: 'Ve a la configuracion del navegador y permite el microfono para esta pagina.',
          variant: 'destructive',
        });
        return;
      }
    };

    recognition.onend = () => {
      // Always restart when enabled (recognition auto-stops after silence)
      if (voiceEnabled) {
        setTimeout(() => {
          try { recognition.start(); } catch { /* */ }
        }, 200);
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    isStartingRef.current = true;
    recognition.start().then(() => {
      setListening(true);
      isStartingRef.current = false;
    }).catch(() => {
      setListening(false);
      isStartingRef.current = false;
    });

    return () => {
      isStartingRef.current = false;
      try { recognition.stop(); } catch { /* */ }
    };
  }, [voiceEnabled, voiceStatus, handleVoiceMatch, toast]);

  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      setListening(false);
      setLastHeard('');
    } else if (voiceStatus === 'supported') {
      setVoiceEnabled(true);
      setLastHeard('');
    } else if (voiceStatus === 'denied') {
      toast({
        title: 'Microfono bloqueado',
        description: 'Permite el microfono en la configuracion del navegador y recarga la pagina.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Voz no disponible',
        description: 'Tu navegador no soporta comandos de voz. Usa Google Chrome en Android.',
        variant: 'destructive',
      });
    }
  }, [voiceEnabled, voiceStatus, toast]);

  /* ── Wake Lock: keep screen on ── */
  useEffect(() => {
    if (!voiceEnabled) return;
    if (!('wakeLock' in navigator)) return;
    let active = true;
    let lock: any = null;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock.request('screen');
        lock.addEventListener('release', () => {
          if (active) setTimeout(request, 1000);
        });
      } catch { /* */ }
    };
    request();
    return () => { active = false; lock?.release(); };
  }, [voiceEnabled]);

  /* ── Photo upload ── */
  const processFile = useCallback(async (file: File) => {
    const cid = photoTargetRef.current;
    if (!cid) return;
    try {
      const dataUrl = await resizeImage(file);
      setContacts(prev => {
        const updated = prev.map(c => c.id === cid ? { ...c, photo: dataUrl } : c);
        saveToStorage(updated);
        return updated;
      });
      setEditContact(prev => prev && prev.id === cid ? { ...prev, photo: dataUrl } : prev);
      toast({ title: 'Foto guardada' });
    } catch {
      toast({ title: 'Error al cargar foto', variant: 'destructive' });
    }
  }, [toast]);

  const onCameraChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const onGalleryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const triggerCamera = useCallback((contactId: string) => {
    photoTargetRef.current = contactId;
    cameraInputRef.current?.click();
  }, []);

  const triggerGallery = useCallback((contactId: string) => {
    photoTargetRef.current = contactId;
    galleryInputRef.current?.click();
  }, []);

  /* ── Contact CRUD ── */
  const handleSaveContact = useCallback(() => {
    if (!editContact) return;
    saveContacts(contacts.map(c => c.id === editContact.id ? editContact : c));
    setEditContact(null);
    toast({ title: 'Guardado' });
  }, [editContact, contacts, saveContacts, toast]);

  const handleAddContact = useCallback(() => {
    if (contacts.length >= 5) {
      toast({ title: 'Maximo 5 contactos', variant: 'destructive' });
      return;
    }
    const nc: Contact = { id: Date.now().toString(), name: 'Nuevo', phone: '', relation: '', photo: '' };
    saveContacts([...contacts, nc]);
    setEditContact(nc);
  }, [contacts, saveContacts, toast]);

  const handleDeleteContact = useCallback((id: string) => {
    if (contacts.length <= 1) {
      toast({ title: 'Necesitas al menos 1 contacto', variant: 'destructive' });
      return;
    }
    saveContacts(contacts.filter(c => c.id !== id));
    setEditContact(null);
  }, [contacts, saveContacts, toast]);

  const configuredCount = contacts.filter(c => c.phone).length;

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <main className="flex-1 flex flex-col items-center px-3 py-4 pb-24 max-w-lg mx-auto w-full select-none">

      {/* ═══ Hidden file inputs - MUST be in DOM for mobile ═══ */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onGalleryChange}
      />

      {/* ═══ Voice Call Overlay ═══ */}
      {pendingCall && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={cancelVoiceCall}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-32 h-32 rounded-3xl overflow-hidden bg-orange-50 mb-4">
              {pendingCall.photo ? (
                <img src={pendingCall.photo} alt={pendingCall.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(pendingCall.id)}`}>
                  <span className="text-white text-6xl font-bold">{getInitial(pendingCall.name)}</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-[#431407] mb-1">Voy a llamar a</p>
            <p className="text-3xl font-bold text-orange-500 mb-4">{pendingCall.name}</p>
            <div className="mx-auto w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center mb-4 animate-pulse">
              <span className="text-white text-4xl font-bold">{countdown}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">Se llama automaticamente...</p>
            <div className="flex gap-3">
              <button onClick={cancelVoiceCall} className="flex-1 h-14 rounded-2xl bg-gray-200 text-gray-700 font-bold text-lg active:scale-95 transition-transform">
                Cancelar
              </button>
              <a
                href={getTelHref(pendingCall)}
                onClick={() => { clearInterval(countdownRef.current); setPendingCall(null); }}
                className="flex-1 h-14 rounded-2xl bg-emerald-500 text-white font-bold text-lg active:scale-95 transition-transform flex items-center justify-center gap-2 no-underline"
              >
                <Phone className="h-6 w-6" /> Llamar ya
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Header ═══ */}
      <header className="w-full flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#9A3412]">Mis Queridos</h1>
          <p className="text-sm text-[#9A3412]/50">
            {voiceEnabled && listening ? 'Escuchando...' : 'Toca para llamar'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mic button - always visible, shows status */}
          <button
            onClick={toggleVoice}
            className={`h-14 w-14 rounded-full flex items-center justify-center shadow-sm border transition-all ${
              voiceEnabled && listening
                ? 'bg-emerald-100 border-emerald-300'
                : voiceStatus === 'denied'
                  ? 'bg-red-100 border-red-300'
                  : voiceStatus === 'not_supported'
                    ? 'bg-gray-100 border-gray-300'
                    : 'bg-white/60 border-gray-200'
            }`}
          >
            {voiceEnabled && listening ? (
              <Mic className="h-7 w-7 text-emerald-600 animate-pulse" />
            ) : voiceStatus === 'not_supported' ? (
              <MicOff className="h-7 w-7 text-gray-400" />
            ) : voiceStatus === 'denied' ? (
              <MicOff className="h-7 w-7 text-red-400" />
            ) : (
              <Mic className="h-7 w-7 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="h-14 w-14 rounded-full bg-white/60 hover:bg-white shadow-sm border border-orange-200 flex items-center justify-center"
          >
            <Settings className="h-7 w-7 text-[#9A3412]" />
          </button>
        </div>
      </header>

      {/* ═══ Listening feedback ═══ */}
      {voiceEnabled && listening && (
        <>
          {lastHeard && (
            <div className="w-full bg-white/80 rounded-2xl px-4 py-2 mb-3 flex items-center gap-2 border border-emerald-200">
              <Volume2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-gray-600 truncate">
                Escuche: <span className="font-medium text-[#431407]">{lastHeard}</span>
              </p>
            </div>
          )}
          <div className="w-full text-center mb-4">
            <p className="text-xs text-[#9A3412]/40">
              Di el nombre para llamar. Ej: &quot;Maria&quot; o &quot;Llamar a Carlos&quot;
            </p>
          </div>
        </>
      )}

      {/* ═══ Contact Grid ═══ */}
      {/* Voice not supported warning */}
      {voiceStatus === 'not_supported' && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
          <p className="text-sm text-amber-800 font-medium">
            La voz no funciona en este navegador. Usa Google Chrome en Android para comandos de voz.
          </p>
        </div>
      )}

      <section className="w-full grid grid-cols-2 gap-4 flex-1">
        {contacts.map((contact) => {
          const telHref = getTelHref(contact);
          const hasPhone = !!contact.phone;

          // If has phone: use <a> tag (single tap, native tel: link)
          // If no phone: use <button> (shows toast to configure)
          if (hasPhone) {
            return (
              <a
                key={contact.id}
                href={telHref}
                className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100 hover:shadow-xl active:scale-[0.97] transition-all duration-150 no-underline"
              >
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
                  {contact.photo ? (
                    <img src={contact.photo} alt={contact.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                      <span className="text-white text-7xl font-bold">{getInitial(contact.name)}</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                    <Phone className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="text-center min-h-[2.5rem] flex items-center justify-center">
                  <p className="text-xl font-bold text-[#431407]">{contact.name}</p>
                </div>
              </a>
            );
          }

          return (
            <button
              key={contact.id}
              onClick={() => handleNoPhone(contact)}
              className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100 active:scale-[0.97] transition-all duration-150"
            >
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
                {contact.photo ? (
                  <img src={contact.photo} alt={contact.name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                    <span className="text-white text-7xl font-bold">{getInitial(contact.name)}</span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <Phone className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold bg-black/40 px-3 py-1.5 rounded-full">Configurar</span>
                </div>
              </div>
              <div className="text-center min-h-[2.5rem] flex items-center justify-center">
                <p className="text-xl font-bold text-[#431407]">{contact.name}</p>
              </div>
            </button>
          );
        })}

        {contacts.length < 5 && (
          <button
            onClick={handleAddContact}
            className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/50 shadow-sm border-2 border-dashed border-orange-200 hover:border-orange-400 hover:bg-orange-50 active:scale-[0.97] transition-all"
          >
            <div className="w-full aspect-square rounded-2xl bg-orange-50 flex items-center justify-center">
              <Plus className="h-16 w-16 text-orange-300" />
            </div>
            <div className="text-center min-h-[2.5rem] flex items-center justify-center">
              <p className="text-lg font-semibold text-[#9A3412]/40">Agregar</p>
            </div>
          </button>
        )}
      </section>

      <div className="mt-4 text-center">
        <p className="text-xs text-[#9A3412]/40">
          {configuredCount} de {contacts.length} listos para llamar
        </p>
      </div>

      {/* ═══ Settings Dialog ═══ */}
      <Dialog open={showSettings && !editContact} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurar</DialogTitle>
          </DialogHeader>

          {/* Voice toggle in settings */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border mb-2 ${
            voiceStatus === 'not_supported'
              ? 'bg-gray-50 border-gray-200'
              : voiceStatus === 'denied'
                ? 'bg-red-50 border-red-200'
                : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div>
              <p className="font-bold text-[#431407]">Voz</p>
              {voiceStatus === 'not_supported' ? (
                <p className="text-sm text-gray-500">No disponible en este navegador</p>
              ) : voiceStatus === 'denied' ? (
                <p className="text-sm text-red-600">Microfono bloqueado</p>
              ) : (
                <p className="text-sm text-gray-500">Di el nombre para llamar</p>
              )}
            </div>
            <button
              onClick={toggleVoice}
              disabled={voiceStatus === 'not_supported'}
              className={`w-16 h-10 rounded-full transition-colors relative ${
                voiceEnabled ? 'bg-emerald-500' : 'bg-gray-300'
              } ${voiceStatus === 'not_supported' ? 'opacity-40' : ''}`}
            >
              <div className={`absolute top-1 w-8 h-8 rounded-full bg-white shadow transition-transform ${voiceEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-2">
            Toca un contacto para editar foto, nombre o numero.
          </p>

          <div className="flex flex-col gap-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => { setEditContact({ ...contact }); setShowSettings(false); }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer"
              >
                <div className="relative">
                  {contact.photo ? (
                    <img src={contact.photo} alt={contact.name} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                      <span className="text-white text-xl font-bold">{getInitial(contact.name)}</span>
                    </div>
                  )}
                  <button
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow"
                    onClick={(e) => { e.stopPropagation(); triggerCamera(contact.id); }}
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-lg font-semibold">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone ? contact.phone : contact.relation ? `${contact.relation} - Sin numero` : 'Sin configurar'}
                  </p>
                </div>
                <User className="h-5 w-5 text-orange-400" />
              </div>
            ))}
            {contacts.length < 5 && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-16 text-lg border-dashed border-orange-300"
                onClick={() => { setShowSettings(false); handleAddContact(); }}
              >
                <Plus className="h-6 w-6 mr-2" /> Agregar Contacto
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Contact Dialog ═══ */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Editar Contacto</DialogTitle>
          </DialogHeader>
          {editContact && (
            <div className="flex flex-col gap-5">
              {/* Photo */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-36 h-36 rounded-3xl overflow-hidden bg-orange-50 shadow-md">
                  {editContact.photo ? (
                    <img src={editContact.photo} alt={editContact.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(editContact.id)}`}>
                      <span className="text-white text-5xl font-bold">{getInitial(editContact.name)}</span>
                    </div>
                  )}
                </div>
                {/* Two BIG buttons - Camera and Gallery - use REAL input refs */}
                <div className="flex gap-3 w-full max-w-xs">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 text-base rounded-2xl gap-2"
                    onClick={() => triggerCamera(editContact.id)}
                  >
                    <Camera className="h-5 w-5" /> Camara
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-14 text-base rounded-2xl gap-2"
                    onClick={() => triggerGallery(editContact.id)}
                  >
                    <ImagePlus className="h-5 w-5" /> Galeria
                  </Button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Nombre</label>
                <Input
                  value={editContact.name}
                  onChange={(e) => setEditContact({ ...editContact, name: e.target.value })}
                  placeholder="Nombre de la persona"
                  className="h-16 text-xl rounded-2xl"
                />
                <p className="text-xs text-gray-400">Usa este nombre para llamar por voz</p>
              </div>

              {/* Relation */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Relacion (opcional)</label>
                <Input
                  value={editContact.relation}
                  onChange={(e) => setEditContact({ ...editContact, relation: e.target.value })}
                  placeholder="Ej: Hija, Hijo, Nieto..."
                  className="h-16 text-xl rounded-2xl"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Numero de telefono</label>
                <Input
                  type="tel"
                  value={editContact.phone}
                  onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                  placeholder="+1 555 123 4567"
                  className="h-16 text-xl rounded-2xl"
                  inputMode="tel"
                />
                <p className="text-sm text-muted-foreground">Incluye el codigo de pais si es internacional</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {contacts.length > 1 && (
                  <Button variant="destructive" className="h-16 text-base rounded-2xl px-6" onClick={() => handleDeleteContact(editContact.id)}>
                    <Trash2 className="h-5 w-5 mr-2" /> Eliminar
                  </Button>
                )}
                <Button
                  className="flex-1 h-16 text-xl rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  onClick={handleSaveContact}
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
