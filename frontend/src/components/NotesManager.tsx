import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  PlusIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface NotesManagerProps {
  onBack: () => void;
}

interface Note {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'reminder' | 'task';
  created_at: number;
  completed: boolean;
}

const NotesManager: React.FC<NotesManagerProps> = ({ onBack }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'note' as Note['type']
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/dashboard/notes');
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      } else {
        setError('Failed to load notes');
      }
    } catch (err) {
      setError('Network error loading notes');
      console.error('Notes fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!formData.title.trim()) return;

    try {
      const response = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes([data.note, ...notes]);
        setFormData({ title: '', content: '', type: 'note' });
        setShowAddForm(false);
      } else {
        setError('Failed to add note');
      }
    } catch (err) {
      setError('Network error adding note');
      console.error('Add note error:', err);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`/api/dashboard/notes?id=${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(notes.filter(note => note.id !== noteId));
      } else {
        setError('Failed to delete note');
      }
    } catch (err) {
      setError('Network error deleting note');
      console.error('Delete note error:', err);
    }
  };

  const toggleComplete = async (note: Note) => {
    const updatedNote = { ...note, completed: !note.completed };
    
    // Optimistically update UI
    setNotes(notes.map(n => n.id === note.id ? updatedNote : n));

    try {
      const response = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedNote),
      });

      if (!response.ok) {
        // Revert on error
        setNotes(notes.map(n => n.id === note.id ? note : n));
        setError('Failed to update note');
      }
    } catch (err) {
      // Revert on error
      setNotes(notes.map(n => n.id === note.id ? note : n));
      setError('Network error updating note');
      console.error('Update note error:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTypeIcon = (type: Note['type']) => {
    switch (type) {
      case 'task':
        return '✓';
      case 'reminder':
        return '⏰';
      default:
        return '📝';
    }
  };

  const getTypeColor = (type: Note['type']) => {
    switch (type) {
      case 'task':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'reminder':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const sortedNotes = [...notes].sort((a, b) => {
    // Incomplete tasks first, then by creation date
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return b.created_at - a.created_at;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Notes & Reminders</h1>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Notes & Reminders</h1>
            <p className="text-gray-400">
              {notes.length} total, {notes.filter(n => !n.completed).length} active
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Note</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-center space-x-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingNote) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingNote ? 'Edit Note' : 'Add New Note'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Note['type'] })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="note">Note</option>
                <option value="reminder">Reminder</option>
                <option value="task">Task</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter title..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter content..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={addNote}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {editingNote ? 'Update' : 'Add'} Note
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingNote(null);
                  setFormData({ title: '', content: '', type: 'note' });
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {sortedNotes.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No notes yet. Create your first note!</p>
          </div>
        ) : (
          sortedNotes.map((note, index) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors ${
                note.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center space-x-3 mb-3">
                    <button
                      onClick={() => toggleComplete(note)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        note.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-600 hover:border-green-500'
                      }`}
                    >
                      {note.completed && <CheckIcon className="h-3 w-3 text-white" />}
                    </button>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(note.type)}`}>
                      {getTypeIcon(note.type)} {note.type}
                    </span>
                    
                    <span className="text-gray-400 text-sm flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatDate(note.created_at)}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className={`text-lg font-semibold mb-2 ${
                    note.completed ? 'line-through text-gray-500' : 'text-white'
                  }`}>
                    {note.title}
                  </h3>
                  
                  {note.content && (
                    <p className={`text-sm leading-relaxed ${
                      note.completed ? 'line-through text-gray-600' : 'text-gray-300'
                    }`}>
                      {note.content}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => {
                      setEditingNote(note);
                      setFormData({
                        title: note.title,
                        content: note.content,
                        type: note.type
                      });
                    }}
                    className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesManager;