import { useEffect, useRef, useState } from "react";
import { Paperclip, Mic, ArrowUp, Square, X, ImagePlus, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconTip } from "@/components/common";
import CameraDialog from "@/components/CameraDialog";
import { uploadImage, errMsg } from "@/lib/api";
import { resizeImage, useDictation } from "@/lib/media";

interface Attachment {
  previewUrl: string;
  path?: string;
  uploading: boolean;
}

interface SendPayload {
  text: string;
  imagePath?: string;
  previewUrl?: string;
}

function AttachmentPreview({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  return (
    <div className="px-3 pt-3">
      <div className="relative inline-block" data-testid="composer-attachment-preview">
        <img src={att.previewUrl} alt="Attachment" className="h-16 w-16 rounded-xl object-cover border border-j-border" />
        {att.uploading && <div className="absolute inset-0 rounded-xl bg-black/50 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
        <button onClick={onRemove} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-j-text text-j-main grid place-items-center" data-testid="composer-remove-attachment">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function Composer({ onSend, onStop, streaming, autoFocus }: {
  onSend: (payload: SendPayload) => void;
  onStop?: () => void;
  streaming?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [att, setAtt] = useState<Attachment | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dictation = useDictation((t) => setText((cur) => (cur ? `${cur} ${t}` : t)), (m) => toast.error(m));

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);

  const attach = async (blob: Blob, name: string) => {
    const previewUrl = URL.createObjectURL(blob);
    setAtt({ previewUrl, uploading: true });
    try {
      const small = await resizeImage(blob);
      const path = await uploadImage(small, name || "image.jpg");
      setAtt({ previewUrl, path, uploading: false });
    } catch (e) {
      setAtt(null);
      toast.error(errMsg(e, "Image upload failed"));
    }
  };

  const canSend = (text.trim() || att?.path) && !att?.uploading && !streaming;
  const send = () => {
    if (!canSend) return;
    onSend({ text: text.trim(), imagePath: att?.path, previewUrl: att?.previewUrl });
    setText("");
    setAtt(null);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const recording = dictation.state === "recording";
  const iconBtn = "h-9 w-9 grid place-items-center rounded-full hover:bg-j-hover transition-colors text-j-text";

  return (
    <div className="w-full">
      <div className="rounded-[26px] bg-j-composer border border-j-border shadow-[0_2px_12px_rgba(0,0,0,0.08)]" data-testid="composer">
        {att && <AttachmentPreview att={att} onRemove={() => setAtt(null)} />}
        <div className="flex items-end gap-1 p-2">
          <DropdownMenu>
            <IconTip label="Attach image" side="top">
              <DropdownMenuTrigger asChild>
                <button className={iconBtn} data-testid="composer-attach-button"><Paperclip className="h-[18px] w-[18px]" /></button>
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="start" side="top" className="w-56 rounded-2xl p-1.5">
              <DropdownMenuItem onSelect={() => fileRef.current?.click()} className="rounded-xl py-2" data-testid="attach-upload-option">
                <ImagePlus className="h-4 w-4 mr-2.5" /> Upload image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCameraOpen(true)} className="rounded-xl py-2" data-testid="attach-camera-option">
                <Camera className="h-4 w-4 mr-2.5" /> Take photo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileRef} type="file" accept="image/*" hidden data-testid="composer-file-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f, f.name); e.target.value = ""; }}
          />
          <textarea
            ref={taRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
            placeholder={recording ? "Listening…" : dictation.state === "transcribing" ? "Transcribing…" : "Message J.A.R.V.I.S."}
            className="flex-1 resize-none bg-transparent outline-none py-2 px-1 text-[15.5px] leading-6 placeholder:text-j-muted max-h-40 scrollbar-thin"
            data-testid="composer-input"
          />
          <IconTip label={recording ? "Stop dictation" : "Dictate"} side="top">
            <button
              onClick={recording ? dictation.stop : dictation.start} disabled={dictation.state === "transcribing"}
              className={`${iconBtn} ${recording ? "bg-red-500/15 text-red-500" : ""}`} data-testid="composer-mic-button"
            >
              {dictation.state === "transcribing" ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : recording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
          </IconTip>
          {streaming ? (
            <IconTip label="Stop generating" side="top">
              <button onClick={onStop} className="h-9 w-9 rounded-full bg-j-text text-j-main grid place-items-center" data-testid="stop-generating-button">
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </IconTip>
          ) : (
            <button
              onClick={send} disabled={!canSend}
              className="h-9 w-9 rounded-full bg-j-accent text-black grid place-items-center transition-opacity disabled:opacity-30"
              data-testid="send-button"
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
      <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(b) => attach(b, "photo.jpg")} />
    </div>
  );
}
