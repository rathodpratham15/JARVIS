import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { MonoLabel } from '@/components/hud/Hud';

interface UploadZoneProps {
  onFile: (file: File, url: string) => void;
  label?: string;
  testid?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFile,
  label = 'Drop image or click to upload',
  testid,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    onFile(file, url);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      data-testid={testid}
      className="hud-panel flex flex-col items-center justify-center py-14 cursor-pointer transition-all duration-200"
      style={{
        borderColor: drag ? '#00b4d8' : 'rgba(0,180,255,0.15)',
        background: drag ? 'rgba(0,180,255,0.06)' : '#071228',
        boxShadow: drag ? '0 0 24px rgba(0,180,255,0.18)' : 'none',
      }}
    >
      <UploadCloud className="w-10 h-10 text-[#00d4ff] mb-3" />
      <MonoLabel>{label}</MonoLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
};
