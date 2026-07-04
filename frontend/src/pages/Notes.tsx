import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { HudPanel, MonoLabel } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = () =>
    fetch('/api/dashboard/notes')
      .then((r) => r.json())
      .then((r) => setNotes(r.notes ?? []))
      .catch(() => {});

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!content.trim()) {
      hudToast.error('CONTENT REQUIRED');
      return;
    }
    try {
      await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), title: title.trim() }),
      });
      setTitle('');
      setContent('');
      await load();
      hudToast.success('NOTE SAVED');
    } catch {
      hudToast.error('SAVE FAILED');
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/dashboard/notes?id=${id}`, { method: 'DELETE' });
      await load();
      hudToast.info('NOTE DELETED');
    } catch {
      hudToast.error('DELETE FAILED');
    }
  };

  return (
    <div data-testid="notes-page">
      <PageHeader overline="Personal Memory Bank" title="NOTES" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <HudPanel className="lg:col-span-1 h-fit" data-testid="note-composer">
          <MonoLabel className="block mb-3">New Note</MonoLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            data-testid="note-title-input"
            className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] mb-3"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note..."
            rows={5}
            data-testid="note-content-input"
            className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] resize-none"
          />
          <button
            onClick={add}
            data-testid="note-save-button"
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)]"
          >
            <Plus className="w-4 h-4" /> SAVE NOTE
          </button>
        </HudPanel>

        <div className="lg:col-span-2 space-y-3" data-testid="notes-list">
          {notes.length === 0 && <MonoLabel>No notes recorded.</MonoLabel>}
          {notes.map((n, i) => (
            <HudPanel
              key={n.id}
              className="jv-fadeup flex items-start justify-between gap-4"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="min-w-0">
                <div className="font-orbitron text-sm tracking-wide text-[#cae8ff]">
                  {n.title || n.content.slice(0, 40) + (n.content.length > 40 ? '…' : '')}
                </div>
                {n.title && <p className="text-sm text-[#9fc4e0] mt-1.5">{n.content}</p>}
                <MonoLabel className="block mt-2">{fmtTime(n.created_at)}</MonoLabel>
              </div>
              <button
                onClick={() => remove(n.id)}
                data-testid={`note-delete-${n.id}`}
                className="shrink-0 text-[#4a7fa0] hover:text-[#ef4444] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </HudPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
