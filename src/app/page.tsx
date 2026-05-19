'use client';

import { useState, useCallback } from 'react';
import { Phone, Settings, Plus, X, Trash2, User, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  photo: string;
}

const DEFAULT_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Maria',
    phone: '',
    relation: 'Hija',
    photo: '',
  },
  {
    id: '2',
    name: 'Carlos',
    phone: '',
    relation: 'Hijo',
    photo: '',
  },
  {
    id: '3',
    name: 'Ana',
    phone: '',
    relation: 'Nieta',
    photo: '',
  },
];

function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return DEFAULT_CONTACTS;
  const saved = localStorage.getItem('mis-queridos-contacts');
  if (saved) {
    try { return JSON.parse(saved); } catch { /* ignore */ }
  }
  return DEFAULT_CONTACTS;
}

const AVATAR_COLORS = [
  'bg-orange-400',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
];

function getAvatarColor(id: string) {
  const index = parseInt(id) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [showSettings, setShowSettings] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const saveContacts = useCallback((newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem('mis-queridos-contacts', JSON.stringify(newContacts));
  }, []);

  const handleCall = useCallback((contact: Contact) => {
    if (!contact.phone) {
      toast({
        title: 'Sin numero de telefono',
        description: `Primero configura el numero de ${contact.name} en los ajustes.`,
        variant: 'destructive',
      });
      return;
    }
    const cleaned = contact.phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleaned}`;
  }, [toast]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, contactId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const updated = contacts.map(c =>
        c.id === contactId ? { ...c, photo: result } : c
      );
      saveContacts(updated);
    };
    reader.readAsDataURL(file);
  }, [contacts, saveContacts]);

  const handleSaveContact = useCallback(() => {
    if (!editContact) return;
    const updated = contacts.map(c =>
      c.id === editContact.id ? editContact : c
    );
    saveContacts(updated);
    setEditContact(null);
    toast({
      title: 'Contacto guardado',
      description: `Los datos de ${editContact.name} se actualizaron correctamente.`,
    });
  }, [editContact, contacts, saveContacts, toast]);

  const handleAddContact = useCallback(() => {
    if (contacts.length >= 5) {
      toast({
        title: 'Maximo alcanzado',
        description: 'Solo puedes agregar hasta 5 contactos.',
        variant: 'destructive',
      });
      return;
    }
    const newContact: Contact = {
      id: Date.now().toString(),
      name: 'Nuevo',
      phone: '',
      relation: '',
      photo: '',
    };
    saveContacts([...contacts, newContact]);
    setShowAddDialog(false);
    setEditContact(newContact);
  }, [contacts, saveContacts, toast]);

  const handleDeleteContact = useCallback((id: string) => {
    if (contacts.length <= 1) {
      toast({
        title: 'No puedes eliminar',
        description: 'Debes tener al menos un contacto.',
        variant: 'destructive',
      });
      return;
    }
    const updated = contacts.filter(c => c.id !== id);
    saveContacts(updated);
    setEditContact(null);
    toast({
      title: 'Contacto eliminado',
      description: 'El contacto fue eliminado correctamente.',
    });
  }, [contacts, saveContacts, toast]);

  const configuredCount = contacts.filter(c => c.phone).length;

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 pb-8 max-w-lg mx-auto w-full">
      {/* Header */}
      <header className="w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#9A3412] tracking-tight">
            Mis Queridos
          </h1>
          <p className="text-base text-[#9A3412]/60 mt-1">
            Toca una foto para llamar
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 rounded-full bg-white/60 hover:bg-white shadow-sm border border-orange-200"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Configuracion"
        >
          <Settings className="h-7 w-7 text-[#9A3412]" />
        </Button>
      </header>

      {/* Contacts Grid */}
      <section className="w-full grid grid-cols-2 gap-5 flex-1" aria-label="Contactos">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => handleCall(contact)}
            className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-white shadow-md border border-orange-100 hover:shadow-lg hover:border-orange-300 active:scale-95 transition-all duration-200 cursor-pointer group"
            aria-label={`Llamar a ${contact.name}`}
          >
            {/* Photo or Avatar */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-orange-50">
              {contact.photo ? (
                <img
                  src={contact.photo}
                  alt={`Foto de ${contact.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                  <span className="text-white text-6xl font-bold select-none">
                    {getInitial(contact.name)}
                  </span>
                </div>
              )}
              {/* Phone icon overlay */}
              <div className="absolute bottom-2 right-2 h-11 w-11 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Phone className="h-5 w-5 text-emerald-600" />
              </div>
              {/* No phone warning */}
              {!contact.phone && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold bg-black/40 px-3 py-1 rounded-full">
                    Sin numero
                  </span>
                </div>
              )}
            </div>
            {/* Name */}
            <div className="text-center">
              <p className="text-xl font-bold text-[#431407] leading-tight">
                {contact.name}
              </p>
              {contact.relation && (
                <p className="text-sm text-[#9A3412]/50 mt-0.5">
                  {contact.relation}
                </p>
              )}
            </div>
          </button>
        ))}

        {/* Add Contact Button (if less than 5) */}
        {contacts.length < 5 && (
          <button
            onClick={handleAddContact}
            className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-white/50 shadow-sm border-2 border-dashed border-orange-200 hover:border-orange-400 hover:bg-orange-50 active:scale-95 transition-all duration-200 cursor-pointer"
            aria-label="Agregar contacto"
          >
            <div className="w-full aspect-square rounded-2xl bg-orange-50 flex items-center justify-center">
              <Plus className="h-12 w-12 text-orange-300" />
            </div>
            <p className="text-lg font-semibold text-[#9A3412]/40">
              Agregar
            </p>
          </button>
        )}
      </section>

      {/* Info badge */}
      <div className="mt-6 text-center">
        <p className="text-sm text-[#9A3412]/40">
          {configuredCount} de {contacts.length} contactos configurados
        </p>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings && !editContact} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Configurar Contactos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Toca un contacto para editar su nombre, numero y foto. Los cambios se guardan automaticamente en tu dispositivo.
          </p>
          <div className="flex flex-col gap-3 mt-2">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => {
                  setEditContact({ ...contact });
                  setShowSettings(false);
                }}
                className="flex items-center gap-4 p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer"
              >
                {contact.photo ? (
                  <img
                    src={contact.photo}
                    alt={contact.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getAvatarColor(contact.id)}`}>
                    <span className="text-white text-xl font-bold">
                      {getInitial(contact.name)}
                    </span>
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="text-lg font-semibold">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone
                      ? contact.phone
                      : contact.relation
                        ? `${contact.relation} - Sin numero`
                        : 'Sin configurar'}
                  </p>
                </div>
                <User className="h-5 w-5 text-orange-400" />
              </button>
            ))}
            {contacts.length < 5 && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-14 text-lg border-dashed border-orange-300"
                onClick={() => {
                  setShowSettings(false);
                  handleAddContact();
                }}
              >
                <Plus className="h-5 w-5 mr-2" />
                Agregar Contacto
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Editar Contacto</DialogTitle>
          </DialogHeader>

          {editContact && (
            <div className="flex flex-col gap-5">
              {/* Photo */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-orange-50">
                  {editContact.photo ? (
                    <img
                      src={editContact.photo}
                      alt={editContact.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getAvatarColor(editContact.id)}`}>
                      <span className="text-white text-4xl font-bold">
                        {getInitial(editContact.name)}
                      </span>
                    </div>
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e, editContact.id)}
                  />
                  <span className="inline-flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-800">
                    <ImagePlus className="h-4 w-4" />
                    Cambiar foto
                  </span>
                </label>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#9A3412]">
                  Nombre
                </label>
                <Input
                  value={editContact.name}
                  onChange={(e) =>
                    setEditContact({ ...editContact, name: e.target.value })
                  }
                  placeholder="Nombre de la persona"
                  className="h-14 text-lg rounded-xl"
                />
              </div>

              {/* Relation */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#9A3412]">
                  Relacion (opcional)
                </label>
                <Input
                  value={editContact.relation}
                  onChange={(e) =>
                    setEditContact({ ...editContact, relation: e.target.value })
                  }
                  placeholder="Ej: Hija, Hijo, Nieto, Amigo..."
                  className="h-14 text-lg rounded-xl"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#9A3412]">
                  Numero de telefono
                </label>
                <Input
                  type="tel"
                  value={editContact.phone}
                  onChange={(e) =>
                    setEditContact({ ...editContact, phone: e.target.value })
                  }
                  placeholder="+1 555 123 4567"
                  className="h-14 text-lg rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Incluye el codigo de pais si es internacional
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1 h-14 text-base rounded-xl"
                  onClick={() => handleDeleteContact(editContact.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
                <Button
                  className="flex-[2] h-14 text-base rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold"
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
