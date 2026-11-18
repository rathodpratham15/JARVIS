import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  AudioLines,
  BookUser,
  Check,
  Clock,
  Folder,
  Library,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  ScanFace,
  Search,
  Settings,
  SquarePen,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';
import type { ConversationSummary } from '../types/jarvis';

interface GroupedHistory {
  label: string;
  items: ConversationSummary[];
}

function groupConversationsByDate(items: ConversationSummary[]): GroupedHistory[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86400000;
  const startOfYesterday = startOfToday - oneDay;
  const sevenDaysAgo = startOfToday - 7 * oneDay;
  const thirtyDaysAgo = startOfToday - 30 * oneDay;

  const groups: Record<string, ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    'Previous 30 days': [],
    Older: [],
  };

  for (const item of items) {
    const t = new Date(item.updatedAt).getTime();
    if (t >= startOfToday) groups.Today.push(item);
    else if (t >= startOfYesterday) groups.Yesterday.push(item);
    else if (t >= sevenDaysAgo) groups['Previous 7 days'].push(item);
    else if (t >= thirtyDaysAgo) groups['Previous 30 days'].push(item);
    else groups.Older.push(item);
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    history,
    activeConversationId,
    sidebarCollapsed,
    mobileDrawerOpen,
    setSidebarCollapsed,
    setMobileDrawerOpen,
    startNewChat,
    loadConversation,
    renameConversation,
    archiveConversation,
    deleteConversation,
    openSettings,
    setSearchOpen,
    setVoiceOpen,
    setVisionOpen,
    signOut,
    projects,
    addProject,
    deleteProject,
    renameProject,
  } = useJarvisStore();

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Project state
  const [newProjectInputOpen, setNewProjectInputOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const newProjectInputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => groupConversationsByDate(history), [history]);

  const handleNewChat = () => {
    startNewChat();
    if (location.pathname !== '/chat') navigate('/chat');
  };

  const handleSelectConversation = async (id: string) => {
    if (location.pathname !== '/chat') navigate('/chat');
    await loadConversation(id);
  };

  const handleStartRename = (item: ConversationSummary) => {
    setRenamingId(item.id);
    setRenameValue(item.title);
    setMenuOpenId(null);
  };

  const handleCommitRename = async (id: string) => {
    if (renameValue.trim()) {
      await renameConversation(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileDrawerOpen(false);
  };

  const handleAddProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    addProject(name);
    setNewProjectName('');
    setNewProjectInputOpen(false);
  };

  const handleStartRenameProject = (id: string, currentName: string) => {
    setRenamingProjectId(id);
    setRenameProjectValue(currentName);
    setProjectMenuId(null);
  };

  const handleCommitRenameProject = (id: string) => {
    if (renameProjectValue.trim()) {
      renameProject(id, renameProjectValue.trim());
    }
    setRenamingProjectId(null);
  };

  const sidebarContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full bg-[#F9F9F9] dark:bg-[#171717] border-r border-[#E5E5E5] dark:border-white/10 select-none">
      {/* Header */}
      <div
        className={`flex items-center h-14 px-3 shrink-0 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsed && (
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center text-white shrink-0">
              <MessageSquare className="w-4 h-4" />
            </span>
            <span className="font-display font-semibold text-sm tracking-tight text-[#171717] dark:text-[#F5F5F5]">
              JARVIS
            </span>
          </button>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Search conversations and contacts"
              aria-label="Search"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (mobileDrawerOpen) setMobileDrawerOpen(false);
              else setSidebarCollapsed(!sidebarCollapsed);
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {mobileDrawerOpen ? (
              <X className="w-4 h-4" />
            ) : isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Primary actions */}
      <div className="px-2.5 space-y-1 shrink-0">
        <button
          type="button"
          onClick={handleNewChat}
          title="New chat"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <SquarePen className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>New chat</span>}
        </button>

        {isCollapsed && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            title="Search"
            className="w-full flex items-center justify-center rounded-lg py-2 text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => { setVoiceOpen(true); setMobileDrawerOpen(false); }}
          title="Voice conversation"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <AudioLines className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>Voice mode</span>}
        </button>

        <button
          type="button"
          onClick={() => { setVisionOpen(true); setMobileDrawerOpen(false); }}
          title="Vision camera"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <ScanFace className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>Vision</span>}
        </button>

        {/* Scheduled & Library */}
        {!isCollapsed && (
          <>
            <div className="pt-1 pb-0.5">
              <div className="h-px bg-[#E5E5E5] dark:bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => handleNavigate('/scheduled')}
              title="Scheduled tasks"
              className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer ${
                location.pathname === '/scheduled'
                  ? 'bg-black/8 dark:bg-[#2A2A2A] text-[#171717] dark:text-[#F5F5F5] font-medium'
                  : 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
              <span>Scheduled</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/library')}
              title="Library"
              className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer ${
                location.pathname === '/library'
                  ? 'bg-black/8 dark:bg-[#2A2A2A] text-[#171717] dark:text-[#F5F5F5] font-medium'
                  : 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Library className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
              <span>Library</span>
            </button>
          </>
        )}
      </div>

      {/* Scrollable content area */}
      {!isCollapsed ? (
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {/* Projects section */}
          <div>
            <div className="flex items-center justify-between px-2.5 pb-1.5">
              <span className="text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA] uppercase tracking-wide">
                Projects
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewProjectInputOpen(true);
                  setTimeout(() => newProjectInputRef.current?.focus(), 20);
                }}
                title="New project"
                aria-label="New project"
                className="p-1 rounded-md text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {newProjectInputOpen && (
              <div className="flex items-center gap-1 px-2 pb-1.5">
                <input
                  ref={newProjectInputRef}
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddProject();
                    if (e.key === 'Escape') {
                      setNewProjectInputOpen(false);
                      setNewProjectName('');
                    }
                  }}
                  placeholder="Project name"
                  className="flex-1 min-w-0 rounded-md bg-[#FFFFFF] dark:bg-[#212121] border border-[#6366f1] px-2 py-1 text-xs focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddProject}
                  className="p-1 text-[#6366f1] hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-0.5">
              {projects.map((proj) => {
                const isActive = location.pathname === `/projects/${proj.id}`;
                const isRenamingThis = renamingProjectId === proj.id;
                const isMenuOpen = projectMenuId === proj.id;

                return (
                  <div
                    key={proj.id}
                    className={`group relative flex items-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-black/8 dark:bg-[#2A2A2A]'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {isRenamingThis ? (
                      <div className="flex items-center w-full px-2 py-1 gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={renameProjectValue}
                          onChange={(e) => setRenameProjectValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitRenameProject(proj.id);
                            if (e.key === 'Escape') setRenamingProjectId(null);
                          }}
                          className="flex-1 min-w-0 rounded-md bg-[#FFFFFF] dark:bg-[#212121] border border-[#6366f1] px-2 py-1 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCommitRenameProject(proj.id)}
                          className="p-1 text-[#6366f1] hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleNavigate(`/projects/${proj.id}`)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left px-2.5 py-2 text-sm truncate cursor-pointer text-[#171717] dark:text-[#F5F5F5]"
                        >
                          <Folder className="w-3.5 h-3.5 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
                          <span className="truncate">{proj.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectMenuId(isMenuOpen ? null : proj.id);
                          }}
                          aria-label="Project options"
                          className={`mr-1 p-1.5 rounded-md text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 transition-opacity cursor-pointer ${
                            isMenuOpen || isActive
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {isMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setProjectMenuId(null)} />
                        <div className="absolute right-1 top-9 z-30 w-36 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-lg py-1">
                          <button
                            type="button"
                            onClick={() => handleStartRenameProject(proj.id, proj.name)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProjectMenuId(null);
                              deleteProject(proj.id);
                              if (location.pathname === `/projects/${proj.id}`) navigate('/chat');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversation history */}
          <div>
            {grouped.length === 0 ? (
              <div className="px-2.5 py-4 text-xs text-[#717171] dark:text-[#A1A1AA]">
                No conversations yet. Start a new chat above.
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label} className="mb-4">
                  <div className="px-2.5 pb-1.5 text-[11px] font-medium text-[#717171] dark:text-[#A1A1AA]">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive =
                        location.pathname === '/' && activeConversationId === item.id;
                      const isRenaming = renamingId === item.id;
                      const isMenuOpen = menuOpenId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`group relative flex items-center rounded-lg transition-colors ${
                            isActive
                              ? 'bg-black/8 dark:bg-[#2A2A2A] text-[#171717] dark:text-[#F5F5F5]'
                              : 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {isRenaming ? (
                            <div className="flex items-center w-full px-2 py-1 gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleCommitRename(item.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                className="flex-1 min-w-0 rounded-md bg-[#FFFFFF] dark:bg-[#212121] border border-[#6366f1] px-2 py-1 text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void handleCommitRename(item.id)}
                                className="p-1 text-[#6366f1] hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSelectConversation(item.id)}
                                className="flex-1 min-w-0 text-left px-2.5 py-2 text-sm truncate cursor-pointer"
                              >
                                {item.title}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(isMenuOpen ? null : item.id);
                                }}
                                aria-label="Conversation options"
                                className={`mr-1 p-1.5 rounded-md text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/10 transition-opacity cursor-pointer ${
                                  isMenuOpen || isActive
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {isMenuOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setMenuOpenId(null)}
                              />
                              <div className="absolute right-1 top-9 z-30 w-36 rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] shadow-lg py-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartRename(item)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void archiveConversation(item.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  <span>Archive</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void deleteConversation(item.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Bottom navigation links */}
      <div className="px-2.5 py-2 border-t border-[#E5E5E5] dark:border-white/10 space-y-0.5 shrink-0">
        <button
          type="button"
          onClick={() => handleNavigate('/contacts')}
          title="Contacts"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer ${
            location.pathname === '/contacts'
              ? 'bg-black/8 dark:bg-[#2A2A2A] text-[#171717] dark:text-[#F5F5F5] font-medium'
              : 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <Users className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>Contacts</span>}
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('/my-contacts')}
          title="My Contacts (Vision discoveries)"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer ${
            location.pathname === '/my-contacts'
              ? 'bg-black/8 dark:bg-[#2A2A2A] text-[#171717] dark:text-[#F5F5F5] font-medium'
              : 'text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <BookUser className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>My Contacts</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            openSettings('general');
            setMobileDrawerOpen(false);
          }}
          title="Settings"
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[#171717] dark:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <Settings className="w-4 h-4 shrink-0 text-[#717171] dark:text-[#A1A1AA]" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>

      {/* User footer */}
      <div className="px-2.5 py-2.5 border-t border-[#E5E5E5] dark:border-white/10 shrink-0">
        <div
          className={`flex items-center gap-2.5 px-1.5 py-1 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              title={user?.name || 'User'}
              className="w-8 h-8 rounded-full bg-[#6366f1]/15 text-[#6366f1] flex items-center justify-center text-xs font-semibold shrink-0"
            >
              {user?.initials || 'U'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5] truncate">
                  {user?.name || 'User'}
                </div>
                <div className="text-[11px] text-[#717171] dark:text-[#A1A1AA] truncate">
                  {user?.email || ''}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="p-2 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-[#171717] dark:hover:text-[#F5F5F5] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <aside
        className={`hidden md:block shrink-0 h-screen transition-[width] duration-200 ease-out ${
          sidebarCollapsed ? 'w-[62px]' : 'w-[260px]'
        }`}
      >
        {sidebarContent(sidebarCollapsed)}
      </aside>

      {/* Mobile slide-in drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-50 w-[272px] max-w-[85vw] h-full shadow-2xl">
            {sidebarContent(false)}
          </aside>
        </div>
      )}
    </>
  );
}
