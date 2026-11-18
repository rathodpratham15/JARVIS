import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  PanelLeft, SquarePen, Search, ScanFace, AudioLines, Users, BookUser, Settings, LogOut, MoreHorizontal,
  Pencil, Archive, Trash2, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { api, errMsg } from "@/lib/api";
import { groupConversations } from "@/lib/format";
import { IconTip, Avatar } from "@/components/common";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Conversation } from "@/types/index";
import type { LucideIcon } from "lucide-react";

function NavItem({ icon: Icon, label, onClick, to, collapsed, testId }: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  collapsed?: boolean;
  testId?: string;
}) {
  const cls = ({ isActive }: { isActive?: boolean } = {}) =>
    `flex items-center gap-3 h-9 rounded-lg text-sm transition-colors hover:bg-j-hover ${collapsed ? "justify-center w-9 mx-auto" : "px-2.5"} ${isActive ? "bg-j-hover font-medium" : ""}`;
  const inner = (<><Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />{!collapsed && <span className="truncate">{label}</span>}</>);
  return (
    <IconTip label={label} enabled={!!collapsed}>
      {to ? (
        <span className="block"><NavLink to={to} onClick={onClick} className={cls} data-testid={testId}>{inner}</NavLink></span>
      ) : (
        <button onClick={onClick} className={cls()} data-testid={testId}>{inner}</button>
      )}
    </IconTip>
  );
}

function ConversationItem({ conv, onDelete, onNavigate }: {
  conv: Conversation;
  onDelete: (c: Conversation) => void;
  onNavigate: () => void;
}) {
  const { setConversations } = useApp();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);

  const rename = async () => {
    setEditing(false);
    if (!title.trim() || title === conv.title) return setTitle(conv.title);
    try {
      const { data } = await api.patch(`/conversations/${conv.id}`, { title });
      setConversations((l) => l.map((c) => (c.id === conv.id ? data : c)));
    } catch (e) { toast.error(errMsg(e)); setTitle(conv.title); }
  };
  const archive = async () => {
    try {
      await api.patch(`/conversations/${conv.id}`, { archived: true });
      setConversations((l) => l.filter((c) => c.id !== conv.id));
      toast.success("Chat archived");
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (editing) {
    return (
      <input
        autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={rename}
        onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") { setTitle(conv.title); setEditing(false); } }}
        className="w-full h-9 px-2.5 rounded-lg bg-j-main border border-j-accent text-sm outline-none"
      />
    );
  }
  return (
    <div className="group relative">
      <NavLink
        to={`/c/${conv.id}`} onClick={onNavigate}
        className={({ isActive }) => `flex items-center h-9 px-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-j-hover" : "hover:bg-j-hover"}`}
      >
        <span className="truncate flex-1 pr-6">{conv.title}</span>
      </NavLink>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="absolute right-1.5 top-1.5 h-6 w-6 grid place-items-center rounded-md opacity-100 md:opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-j-hover">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil className="h-4 w-4 mr-2" />Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={archive}><Archive className="h-4 w-4 mr-2" />Archive</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(conv)} className="text-red-500 focus:text-red-500"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function History({ onNavigate }: { onNavigate: () => void }) {
  const { conversations, convState, refreshConversations, setConversations, currentConvId } = useApp();
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<Conversation | null>(null);

  const confirmDelete = async () => {
    const conv = toDelete;
    setToDelete(null);
    if (!conv) return;
    try {
      await api.delete(`/conversations/${conv.id}`);
      setConversations((l) => l.filter((c) => c.id !== conv.id));
      if (currentConvId === conv.id) navigate("/");
      toast.success("Chat deleted");
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-2 mt-4" data-testid="conversation-history">
      {convState === "loading" && [...Array(6)].map((_, i) => <div key={i} className="h-7 my-1.5 mx-2 rounded-md bg-j-hover animate-pulse" />)}
      {convState === "error" && (
        <button onClick={refreshConversations} className="text-xs text-j-muted px-2.5 hover:underline">Couldn't load chats. Retry</button>
      )}
      {convState === "ready" && !conversations.length && <p className="text-xs text-j-muted px-2.5">Your chats will appear here.</p>}
      {groupConversations(conversations).map(([label, items]) => (
        <div key={label} className="mb-4">
          <p className="px-2.5 pb-1 text-xs font-medium text-j-muted">{label}</p>
          {items.map((c) => <ConversationItem key={c.id} conv={c} onDelete={setToDelete} onNavigate={onNavigate} />)}
        </div>
      ))}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>This will delete "{toDelete?.title}". This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Sidebar({ collapsed, mobile }: { collapsed?: boolean; mobile?: boolean }) {
  const { user, signOut, setSidebarOpen, setMobileOpen, openModal } = useApp();
  const navigate = useNavigate();
  const close = () => mobile && setMobileOpen(false);
  const toggle = () => (mobile ? setMobileOpen(false) : setSidebarOpen((o) => !o));

  return (
    <div className={`flex flex-col h-full ${collapsed ? "w-[60px]" : "w-full min-w-[260px]"} py-2`}>
      <div className={`flex items-center h-11 ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {!collapsed && (
          <button onClick={() => { navigate("/"); close(); }} className="flex items-center gap-2 px-1.5 h-9 rounded-lg hover:bg-j-hover" data-testid="sidebar-logo">
            <div className="h-6 w-6 rounded-md bg-j-accent grid place-items-center"><MessageSquare className="h-3.5 w-3.5 text-black" /></div>
            <span className="font-semibold text-[15px]">J.A.R.V.I.S.</span>
          </button>
        )}
        <IconTip label={collapsed ? "Open sidebar" : "Close sidebar"}>
          <button onClick={toggle} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-j-hover text-j-muted" data-testid="sidebar-toggle">
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
        </IconTip>
      </div>

      <nav className={`flex flex-col gap-0.5 mt-2 ${collapsed ? "" : "px-2"}`}>
        <NavItem icon={SquarePen} label="New chat" collapsed={collapsed} testId="new-chat-button" onClick={() => { navigate("/"); close(); }} />
        <NavItem icon={Search} label="Search chats" collapsed={collapsed} testId="search-button" onClick={() => { openModal("search"); close(); }} />
        <NavItem icon={ScanFace} label="Vision" to="/vision" collapsed={collapsed} testId="nav-vision" onClick={close} />
        <NavItem icon={AudioLines} label="Voice mode" collapsed={collapsed} testId="nav-voice" onClick={() => { openModal("voice"); close(); }} />
      </nav>

      {collapsed ? <div className="flex-1" /> : <History onNavigate={close} />}

      <nav className={`flex flex-col gap-0.5 pt-2 border-t border-j-border ${collapsed ? "" : "px-2"}`}>
        <NavItem icon={Users} label="Contacts" to="/contacts" collapsed={collapsed} testId="nav-contacts" onClick={close} />
        <NavItem icon={BookUser} label="My Contacts" to="/my-contacts" collapsed={collapsed} testId="nav-my-contacts" onClick={close} />
        <NavItem icon={Settings} label="Settings" collapsed={collapsed} testId="nav-settings" onClick={() => { openModal("settings", { tab: "general" }); close(); }} />
      </nav>

      <div className={`mt-2 flex items-center gap-2.5 ${collapsed ? "flex-col" : "px-2.5"}`} data-testid="sidebar-user">
        <Avatar name={user?.name} src={user?.picture} size={30} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" data-testid="sidebar-username">{user?.name}</p>
            <p className="text-xs text-j-muted truncate">{user?.email}</p>
          </div>
        )}
        <IconTip label="Sign out" side={collapsed ? "right" : "top"}>
          <button onClick={signOut} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-j-hover text-j-muted" data-testid="sign-out-button">
            <LogOut className="h-4 w-4" />
          </button>
        </IconTip>
      </div>
    </div>
  );
}
