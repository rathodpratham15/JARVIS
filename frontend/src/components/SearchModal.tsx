import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Search, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useJarvisStore } from '../store/useJarvisStore';
import type { Contact } from '../types/jarvis';

export function SearchModal() {
  const navigate = useNavigate();
  const {
    searchOpen,
    setSearchOpen,
    loadConversation,
    setSelectedContactId,
  } = useJarvisStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<
    Array<{ id: string; title: string; updatedAt: string; snippet: string }>
  >([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery('');
      setConversations([]);
      setContacts([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setConversations([]);
      setContacts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(trimmed);
        setConversations(res.conversations);
        setContacts(res.contacts);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, searchOpen]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={() => setSearchOpen(false)}
      />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E5] dark:border-white/10">
          <Search className="w-4 h-4 text-[#717171] dark:text-[#A1A1AA] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations and contacts..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[#717171] dark:placeholder:text-[#A1A1AA]"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-[#717171] dark:text-[#A1A1AA]">
              Type to search messages, titles, or contact details.
            </div>
          ) : loading ? (
            <div className="py-8 text-center text-xs text-[#717171] dark:text-[#A1A1AA]">
              Searching…
            </div>
          ) : conversations.length === 0 && contacts.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#717171] dark:text-[#A1A1AA]">
              No matching conversations or contacts found.
            </div>
          ) : (
            <>
              {conversations.length > 0 && (
                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA]">
                    Conversations
                  </div>
                  <div className="space-y-1">
                    {conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate('/');
                          void loadConversation(c.id);
                        }}
                        className="w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-[#6366f1] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.title}</div>
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA] truncate">
                            {c.snippet}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {contacts.length > 0 && (
                <div>
                  <div className="px-2 pb-1.5 text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA]">
                    Contacts
                  </div>
                  <div className="space-y-1">
                    {contacts.map((cnt) => (
                      <button
                        key={cnt.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setSelectedContactId(cnt.id);
                          navigate(cnt.source === 'vision' ? '/my-contacts' : '/contacts');
                        }}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-[#717171] dark:text-[#A1A1AA] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{cnt.name}</div>
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA] truncate">
                            {[cnt.phone, cnt.email].filter(Boolean).join(' · ') || 'Contact'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
