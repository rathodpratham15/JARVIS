import { useRef } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCamera } from "@/lib/media";
import { PillButton } from "@/components/common";

function CameraBody({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, capture } = useCamera(videoRef, true);
  const take = async () => {
    const blob = await capture();
    if (blob) onCapture(blob);
  };
  return (
    <div className="space-y-4">
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" data-testid="camera-capture-video" />
        {status === "init" && <div className="absolute inset-0 grid place-items-center text-zinc-300"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {(status === "denied" || status === "error" || status === "unsupported") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-300 text-sm px-6 text-center" data-testid="camera-capture-error">
            <CameraOff className="h-7 w-7" />
            {status === "denied" ? "Camera access was denied. Allow it in your browser's site settings and try again." : "No camera available on this device."}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <PillButton variant="accent" onClick={take} disabled={status !== "live"} data-testid="camera-capture-button">
          <Camera className="h-4 w-4" /> Take photo
        </PillButton>
      </div>
    </div>
  );
}

export default function CameraDialog({ open, onOpenChange, onCapture }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (blob: Blob) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl" data-testid="camera-dialog">
        <DialogHeader><DialogTitle>Take photo</DialogTitle></DialogHeader>
        {open && <CameraBody onCapture={(b) => { onCapture(b); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}
