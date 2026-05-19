'use client';

import { useState, useCallback, useRef } from 'react';
import { Phone, Settings, Plus, Trash2, User, ImagePlus, Camera, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ═══ TYPES ═══ */
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

/* ═══ QUICK MESSAGES ═══ */
const QUICK_MESSAGES = [
  { text: 'VEN', emoji: '🏠', color: 'bg-blue-500 hover:bg-blue-600' },
  { text: 'TENGO HAMBRE', emoji: '🍽️', color: 'bg-orange-500 hover:bg-orange-600' },
  { text: 'DONDE ESTAS', emoji: '📍', color: 'bg-violet-500 hover:bg-violet-600' },
];

/* ═══ HELPERS ═══ */
function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  try {
    const saved = localStorage.getItem('mis-queridos-contacts');
    if (saved) return JSON.parse(saved);
  } catch { /* */ }
  return DEFAULT_CONTACTS;
}

function saveToStorage(contacts: Contact[]) {
  try {
    localStorage.setItem('mis-queridos-contacts', JSON.stringify(contacts));
    return true;
  } catch {
    try {
      const light = contacts.map(c => ({ ...c, photo: '' }));
      localStorage.setItem('mis-queridos-contacts', JSON.stringify(light));
    } catch { /* */ }
    return false;
  }
}

function getAvatarColor(id: string) { return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]; }
function getInitial(name: string) { return name.charAt(0).toUpperCase(); }

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function resizeImage(file: File, maxPx = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('img'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxPx) { h = (h * maxPx) / w; w = maxPx; } }
        else { if (h > maxPx) { w = (w * maxPx) / h; h = maxPx; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ═══ MAIN ═══ */
export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [showSettings, setShowSettings] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showMsgPicker, setShowMsgPicker] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState('');
  const { toast } = useToast();

  // Photo inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string>('');

  const saveContacts = useCallback((nc: Contact[]) => {
    setContacts(nc);
    if (!saveToStorage(nc)) {
      toast({ title: 'Memoria llena', description: 'Se guardaron datos sin fotos.', variant: 'destructive' });
    }
  }, [toast]);

  /* ── Photo upload ── */
  const processFile = useCallback(async (file: File) => {
    const cid = photoTargetRef.current;
    if (!cid) return;
    try {
      const dataUrl = await resizeImage(file);
      setContacts(prev => {
        const u = prev.map(c => c.id === cid ? { ...c, photo: dataUrl } : c);
        saveToStorage(u);
        return u;
      });
      setEditContact(prev => prev && prev.id === cid ? { ...prev, photo: dataUrl } : prev);
      toast({ title: 'Foto guardada' });
    } catch {
      toast({ title: 'Error al cargar foto', variant: 'destructive' });
    }
  }, [toast]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const triggerCamera = useCallback((cid: string) => { photoTargetRef.current = cid; cameraInputRef.current?.click(); }, []);
  const triggerGallery = useCallback((cid: string) => { photoTargetRef.current = cid; galleryInputRef.current?.click(); }, []);

  /* ── Messages ── */
  const openMsgPicker = useCallback((msg: string) => {
    const configured = contacts.filter(c => c.phone);
    if (configured.length === 0) {
      toast({ title: 'Sin contactos', description: 'Configura al menos un contacto con numero.', variant: 'destructive' });
      return;
    }
    if (configured.length === 1) {
      // Only one contact - send directly
      window.location.href = `sms:${cleanPhone(configured[0].phone)}?body=${encodeURIComponent(msg)}`;
      return;
    }
    setSelectedMsg(msg);
    setShowMsgPicker(true);
  }, [contacts, toast]);

  const sendMessage = useCallback((phone: string) => {
    window.location.href = `sms:${cleanPhone(phone)}?body=${encodeURIComponent(selectedMsg)}`;
    setShowMsgPicker(false);
  }, [selectedMsg]);

  /* ── Contact CRUD ── */
  const handleSaveContact = useCallback(() => {
    if (!editContact) return;
    saveContacts(contacts.map(c => c.id === editContact.id ? editContact : c));
    setEditContact(null);
    toast({ title: 'Guardado' });
  }, [editContact, contacts, saveContacts, toast]);

  const handleAddContact = useCallback(() => {
    if (contacts.length >= 5) { toast({ title: 'Maximo 5', variant: 'destructive' }); return; }
    const nc: Contact = { id: Date.now().toString(), name: 'Nuevo', phone: '', relation: '', photo: '' };
    saveContacts([...contacts, nc]);
    setEditContact(nc);
  }, [contacts, saveContacts, toast]);

  const handleDeleteContact = useCallback((id: string) => {
    if (contacts.length <= 1) { toast({ title: 'Necesitas al menos 1', variant: 'destructive' }); return; }
    saveContacts(contacts.filter(c => c.id !== id));
    setEditContact(null);
  }, [contacts, saveContacts, toast]);

  const configuredCount = contacts.filter(c => c.phone).length;

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <main className="flex-1 flex flex-col items-center px-3 py-3 pb-4 max-w-lg mx-auto w-full">

      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {/* ═══ Header ═══ */}
      <header className="w-full flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-[#9A3412]">Mis Queridos</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="h-14 w-14 rounded-full bg-white/60 shadow-sm border border-orange-200 flex items-center justify-center"
        >
          <Settings className="h-7 w-7 text-[#9A3412]" />
        </button>
      </header>

      {/* ═══ QUICK MESSAGES - 3 big buttons ═══ */}
      <section className="w-full grid grid-cols-3 gap-2 mb-4" aria-label="Mensajes rapidos">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg.text}
            onClick={() => openMsgPicker(msg.text)}
            className={`${msg.color} text-white rounded-2xl py-4 px-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-md`}
          >
            <span className="text-3xl">{msg.emoji}</span>
            <span className="text-sm font-bold leading-tight">{msg.text}</span>
          </button>
        ))}
      </section>

      {/* ═══ BIG GREEN BLINKING CALL BUTTON ═══ */}
      {configuredCount > 0 && (
        <section className="w-full mb-4">
          {contacts.filter(c => c.phone).map((contact) => (
            <a
              key={`call-${contact.id}`}
              href={`tel:${cleanPhone(contact.phone)}`}
              className="flex items-center justify-center w-full h-20 rounded-2xl bg-emerald-500 active:bg-emerald-600 shadow-xl animate-pulse gap-4 no-underline"
              style={{ animationDuration: '2s' }}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                {contact.photo ? (
                  <img src={contact.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{getInitial(contact.name)}</span>
                )}
              </div>
              <div className="text-white text-left">
                <p className="text-lg font-bold leading-tight">LLAMAR A</p>
                <p className="text-2xl font-black">{contact.name.toUpperCase()}</p>
              </div>
              <Phone className="h-10 w-10 text-white ml-auto shrink-0" />
            </a>
          ))}
        </section>
      )}

      {/* ═══ Contact Photos Grid ═══ */}
      <section className="w-full grid grid-cols-2 gap-4 flex-1" aria-label="Contactos">
        {contacts.map((contact) => {
          const hasPhone = !!contact.phone;

          if (hasPhone) {
            return (
              <a
                key={contact.id}
                href={`tel:${cleanPhone(contact.phone)}`}
                className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white shadow-md border border-orange-100 active:scale-[0.97] transition-all duration-150 no-underline"
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
                <p className="text-xl font-bold text-[#431407] text-center">{contact.name}</p>
              </a>
            );
          }

          return (
            <button
              key={contact.id}
              onClick={() => {
                setEditContact({ ...contact });
              }}
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
              <p className="text-xl font-bold text-[#431407] text-center">{contact.name}</p>
            </button>
          );
        })}

        {contacts.length < 5 && (
          <button
            onClick={handleAddContact}
            className="flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/50 shadow-sm border-2 border-dashed border-orange-200 active:scale-[0.97] transition-all"
          >
            <div className="w-full aspect-square rounded-2xl bg-orange-50 flex items-center justify-center">
              <Plus className="h-16 w-16 text-orange-300" />
            </div>
            <p className="text-lg font-semibold text-[#9A3412]/40">Agregar</p>
          </button>
        )}
      </section>

      {/* ═══ Message Contact Picker Dialog ═══ */}
      <Dialog open={showMsgPicker} onOpenChange={setShowMsgPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Enviar: &quot;{selectedMsg}&quot;</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Toca a quien le quieres enviar el mensaje.</p>
          <div className="flex flex-col gap-3 mt-2">
            {contacts.filter(c => c.phone).map(contact => (
              <a
                key={contact.id}
                href={`sms:${cleanPhone(contact.phone)}?body=${encodeURIComponent(selectedMsg)}`}
                onClick={() => setShowMsgPicker(false)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors no-underline"
              >
                {contact.photo ? (
                  <img src={contact.photo} alt={contact.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                    <span className="text-white text-xl font-bold">{getInitial(contact.name)}</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-bold text-[#431407]">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{contact.relation || contact.phone}</p>
                </div>
                <MessageCircle className="h-6 w-6 text-orange-500" />
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Settings Dialog ═══ */}
      <Dialog open={showSettings && !editContact} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Toca un contacto para editar foto, nombre o numero.
          </p>
          <div className="flex flex-col gap-3">
            {contacts.map(contact => (
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
                <div className="flex gap-3 w-full max-w-xs">
                  <Button variant="outline" className="flex-1 h-14 text-base rounded-2xl gap-2" onClick={() => triggerCamera(editContact.id)}>
                    <Camera className="h-5 w-5" /> Camara
                  </Button>
                  <Button variant="outline" className="flex-1 h-14 text-base rounded-2xl gap-2" onClick={() => triggerGallery(editContact.id)}>
                    <ImagePlus className="h-5 w-5" /> Galeria
                  </Button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Nombre</label>
                <Input value={editContact.name} onChange={(e) => setEditContact({ ...editContact, name: e.target.value })} placeholder="Nombre" className="h-16 text-xl rounded-2xl" />
              </div>

              {/* Relation */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Relacion (opcional)</label>
                <Input value={editContact.relation} onChange={(e) => setEditContact({ ...editContact, relation: e.target.value })} placeholder="Hija, Hijo, Nieto..." className="h-16 text-xl rounded-2xl" />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-base font-semibold text-[#9A3412]">Numero de telefono</label>
                <Input type="tel" value={editContact.phone} onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })} placeholder="+1 555 123 4567" className="h-16 text-xl rounded-2xl" inputMode="tel" />
                <p className="text-sm text-muted-foreground">Incluye codigo de pais si es internacional</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {contacts.length > 1 && (
                  <Button variant="destructive" className="h-16 text-base rounded-2xl px-6" onClick={() => handleDeleteContact(editContact.id)}>
                    <Trash2 className="h-5 w-5 mr-2" /> Eliminar
                  </Button>
                )}
                <Button className="flex-1 h-16 text-xl rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold" onClick={handleSaveContact}>
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
