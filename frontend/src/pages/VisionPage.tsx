import { useEffect, useRef, useState } from "react";
import { ScanFace, CameraOff, Loader2, UserPlus, UserX, BookmarkPlus, AlertTriangle, Trash2, Upload, Camera } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fileUrl } from "@/lib/api";
import { useCamera, resizeImage } from "@/lib/media";
import { PageHeader } from "@/components/TopBar";
import { Avatar, PillButton } from "@/components/common";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FacePerson {
  id: string;
  name: string;
  role?: string;
  photo_path?: string;
}
interface FaceMatch {
  name: string;
  role?: string;
  photo_path?: string;
  confidence?: number;
  notes?: string;
}
type ScanResult =
  | { kind: "match"; match: FaceMatch }
  | { kind: "nomatch" }
  | { kind: "unavailable"; detail: string };

function EnrollDialog({ open, onOpenChange, initialBlob, onEnrolled }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialBlob: Blob | null;
  onEnrolled: (p: FacePerson) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(""); setRole(""); setPhoto(initialBlob || null); } }, [open, initialBlob]);
  const preview = photo ? URL.createObjectURL(photo) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !photo) return toast.error("Name and photo are required");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("role", role);
      fd.append("photo", await resizeImage(photo, 1024), "face.jpg");
      const { data } = await api.post("/face/add-person", fd);
      onEnrolled(data);
      onOpenChange(false);
      toast.success(`${data.name} enrolled`);
    } catch (err) { toast.error(errMsg(err)); }
    setSaving(false);
  };
  const input = "w-full h-10 rounded-xl bg-j-surface border border-j-border px-3 text-sm outline-none focus:border-j-accent";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-j-main border-j-border">
        <DialogHeader><DialogTitle>Enroll a person</DialogTitle><DialogDescription>Add a name and a clear photo of their face.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="text-xs text-j-muted">Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${input} mt-1.5`} /></label>
          <label className="block"><span className="text-xs text-j-muted">Role or title</span><input value={role} onChange={(e) => setRole(e.target.value)} className={`${input} mt-1.5`} /></label>
          <div className="flex items-center gap-4">
            {preview ? <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-j-surface grid place-items-center"><Camera className="h-6 w-6 text-j-muted" /></div>}
            <label className="h-9 px-4 rounded-full border border-j-border hover:bg-j-hover text-sm inline-flex items-center gap-2 cursor-pointer">
              <Upload className="h-4 w-4" /> {photo ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setPhoto(e.target.files[0])} />
            </label>
          </div>
          <div className="flex justify-end">
            <PillButton type="submit" variant="accent" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enroll</PillButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResultCard({ result, onEnroll, onSave, saving }: {
  result: ScanResult;
  onEnroll: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (result.kind === "unavailable") {
    return (
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-amber-500/15 grid place-items-center shrink-0"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
        <div className="flex-1">
          <p className="font-medium text-sm">Face recognition is unavailable</p>
          <p className="text-xs text-j-muted mt-1">{result.detail}</p>
          <PillButton variant="ghost" className="mt-3" onClick={onEnroll}><UserPlus className="h-4 w-4" />Enroll this person</PillButton>
        </div>
      </div>
    );
  }
  if (result.kind === "nomatch") {
    return (
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-j-surface grid place-items-center"><UserX className="h-5 w-5 text-j-muted" /></div>
        <p className="flex-1 font-medium text-sm">Person not recognized</p>
        <PillButton variant="accent" onClick={onEnroll}><UserPlus className="h-4 w-4" />Enroll</PillButton>
      </div>
    );
  }
  const m = result.match;
  return (
    <div className="flex items-center gap-3">
      {m.photo_path ? <img src={fileUrl(m.photo_path)} alt={m.name} className="h-14 w-14 rounded-xl object-cover" /> : <Avatar name={m.name} size={56} />}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{m.name}</p>
        <p className="text-xs text-j-muted truncate">{m.role || "—"}</p>
        <p className="text-xs text-emerald-500 mt-0.5">{Math.round((m.confidence || 0) * 100)}% confidence</p>
      </div>
      <PillButton variant="accent" onClick={onSave} disabled={saving}><BookmarkPlus className="h-4 w-4" />Save to My Contacts</PillButton>
    </div>
  );
}

function EnrolledList({ people, onDelete }: { people: FacePerson[] | null; onDelete: (p: FacePerson) => void }) {
  if (!people) return <div className="h-16 rounded-xl bg-j-hover animate-pulse" />;
  if (!people.length) return <p className="text-sm text-j-muted">No one enrolled yet.</p>;
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
      {people.map((p) => (
        <div key={p.id} className="group relative shrink-0 w-24 text-center">
          <img src={fileUrl(p.photo_path || "")} alt={p.name} className="h-24 w-24 rounded-2xl object-cover bg-j-surface" />
          <p className="text-xs mt-1.5 truncate">{p.name}</p>
          <button onClick={() => onDelete(p)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center opacity-100 md:opacity-0 group-hover:opacity-100">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function VisionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, capture } = useCamera(videoRef, true);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [frame, setFrame] = useState<Blob | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [people, setPeople] = useState<FacePerson[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/face/list").then(({ data }) => setPeople(data)).catch(() => setPeople([])); }, []);

  const scan = async () => {
    const blob = await capture();
    if (!blob) return;
    setFrame(blob);
    setScanning(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("image", blob, "frame.jpg");
      const { data } = await api.post("/face/identify", fd);
      setResult(data.match ? { kind: "match", match: data.match } : { kind: "nomatch" });
    } catch (e: unknown) {
      const status = (e as { response?: { status: number } })?.response?.status;
      if (status === 503) setResult({ kind: "unavailable", detail: errMsg(e) });
      else toast.error(errMsg(e, "Scan failed"));
    }
    setScanning(false);
  };

  const saveMatch = async () => {
    if (!result || result.kind !== "match") return;
    const m = result.match;
    setSaving(true);
    try {
      await api.post("/discoveries", { name: m.name, role: m.role, photo_path: m.photo_path, confidence: m.confidence, notes: m.notes || "" });
      toast.success(`${m.name} saved to My Contacts`);
    } catch (e) { toast.error(errMsg(e)); }
    setSaving(false);
  };

  const deletePerson = async (p: FacePerson) => {
    try { await api.delete(`/face/${p.id}`); setPeople((l) => l!.filter((x) => x.id !== p.id)); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const blocked = status === "denied" || status === "error" || status === "unsupported";

  return (
    <div className="flex flex-col h-full" data-testid="vision-page">
      <PageHeader title="Vision">
        <PillButton variant="ghost" onClick={() => { setFrame(null); setEnrollOpen(true); }}><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Enroll person</span></PillButton>
      </PageHeader>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-[860px] mx-auto px-4 py-6 space-y-5">
          <div className="relative aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
            {status === "live" && (
              <span className="absolute top-4 left-4 flex items-center gap-2 text-xs text-white bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            )}
            {status === "init" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-300 text-sm">
                <Loader2 className="h-6 w-6 animate-spin" /> Starting camera…
              </div>
            )}
            {blocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-300 text-sm px-8 text-center">
                <CameraOff className="h-8 w-8" />
                <p className="font-medium text-white">{status === "denied" ? "Camera access denied" : "No camera available"}</p>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 text-white text-sm">
                <Loader2 className="h-8 w-8 animate-spin" /> Scanning…
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button onClick={scan} disabled={status !== "live" || scanning}
              className="h-12 px-8 rounded-full bg-j-accent text-black font-medium flex items-center gap-2 disabled:opacity-40 transition-opacity">
              <ScanFace className="h-5 w-5" /> Scan
            </button>
          </div>

          {result && (
            <div className="rounded-2xl border border-j-border bg-j-surface/50 p-4">
              <ResultCard result={result} saving={saving} onSave={saveMatch} onEnroll={() => setEnrollOpen(true)} />
            </div>
          )}

          <div className="pt-4">
            <p className="text-sm font-medium mb-3">Enrolled people</p>
            <EnrolledList people={people} onDelete={deletePerson} />
          </div>
        </div>
      </div>
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} initialBlob={frame}
        onEnrolled={(p) => setPeople((l) => [p, ...(l || [])])} />
    </div>
  );
}
