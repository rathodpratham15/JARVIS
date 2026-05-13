import { useState, useRef } from 'react';
import { PhotoIcon, UserIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ImageUploadProps {
  onImageAnalysis: (file: File, analysisType: 'face' | 'vision') => void;
  isProcessing: boolean;
  onClose: () => void;
}

export default function ImageUpload({ onImageAnalysis, isProcessing, onClose }: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalysis = (type: 'face' | 'vision') => {
    if (selectedFile) {
      onImageAnalysis(selectedFile, type);
      // Auto-collapse after starting analysis
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const clearImage = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glassmorphic p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-mono text-accent-blue">Visual Analysis</h3>
        <button
          onClick={() => {
            clearImage();
            onClose();
          }}
          className="p-2 hover:bg-glass-light/50 rounded-lg transition-colors"
          title="Close"
        >
          <XMarkIcon className="w-5 h-5 text-accent-silver/70 hover:text-accent-silver" />
        </button>
      </div>
      
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragActive 
            ? 'border-accent-blue bg-accent-blue/10' 
            : preview 
              ? 'border-accent-silver/30' 
              : 'border-glass-light hover:border-accent-blue/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
          disabled={isProcessing}
        />
        
        {preview ? (
          <div className="space-y-4">
            <img 
              src={preview} 
              alt="Preview" 
              className="max-w-full max-h-48 mx-auto rounded-lg shadow-lg"
            />
            <div className="flex justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearImage();
                }}
                className="px-3 py-1 text-sm bg-glass-light rounded-lg hover:bg-glass-light/70 transition-colors"
                disabled={isProcessing}
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <PhotoIcon className="w-16 h-16 mx-auto text-accent-silver/50" />
            <div>
              <p className="text-accent-silver">
                Drag and drop an image here, or click to select
              </p>
              <p className="text-sm text-accent-silver/70 mt-1">
                Supports JPG, PNG, GIF up to 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Buttons */}
      {selectedFile && !isProcessing && (
        <div className="flex gap-4">
          <button
            onClick={() => handleAnalysis('face')}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-accent-blue/20 text-accent-blue rounded-xl hover:bg-accent-blue/30 transition-colors"
          >
            <UserIcon className="w-5 h-5" />
            Identify Person
          </button>
          
          <button
            onClick={() => handleAnalysis('vision')}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-accent-silver/20 text-accent-silver rounded-xl hover:bg-accent-silver/30 transition-colors"
          >
            <EyeIcon className="w-5 h-5" />
            Analyze Image
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 p-3 text-accent-blue">
          <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
          Processing image...
        </div>
      )}
    </div>
  );
} 