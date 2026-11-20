import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Loader2,
  ScanFace,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useJarvisStore } from '../store/useJarvisStore';
import type { FaceIdentifyResult } from '../types/jarvis';

type CameraState = 'initializing' | 'active' | 'denied';

export function VisionModeOverlay() {
  const {
    visionOpen,
    setVisionOpen,
    enrolledFaces,
    refreshEnrolledFaces,
    deleteEnrolledFace,
    createContact,
  } = useJarvisStore();

  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FaceIdentifyResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Enroll modal / view
  const [activeTab, setActiveTab] = useState<'camera' | 'enroll' | 'directory'>('camera');
  const [enrollName, setEnrollName] = useState('');
  const [enrollRole, setEnrollRole] = useState('');
  const [enrollNotes, setEnrollNotes] = useState('');
  const [enrollPhotoDataUrl, setEnrollPhotoDataUrl] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadScanInputRef = useRef<HTMLInputElement>(null);
  const enrollFileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visionOpen || activeTab !== 'camera') {
      stopCamera();
      return;
    }

    let active = true;
    setCameraState('initializing');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraState('active');
      })
      .catch(() => {
        if (active) setCameraState('denied');
      });

    return () => {
      active = false;
      stopCamera();
    };
  }, [visionOpen, activeTab, stopCamera]);

  const identifyBlob = async (blob: Blob) => {
    setScanning(true);
    setScanError(null);
    setSavedNotice(false);
    try {
      const fd = new FormData();
      fd.append('image', blob, 'scan.jpg');
      const result = await api.identifyFace(fd);
      setScanResult(result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Face scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleScanFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) void identifyBlob(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleSaveToMyContacts = async () => {
    if (!scanResult || !scanResult.matched || !scanResult.name) return;
    await createContact({
      name: scanResult.name,
      role: scanResult.role || '',
      photoUrl: scanResult.photoUrl || scanResult.capturedDataUrl,
      notes: scanResult.notes,
      confidence: scanResult.confidence,
      lastSeen: new Date().toISOString(),
      personId: scanResult.personId,
      source: 'vision',
    });
    setSavedNotice(true);
  };

  const handleEnrollFromNoMatch = () => {
    if (scanResult?.capturedDataUrl) {
      setEnrollPhotoDataUrl(scanResult.capturedDataUrl);
    }
    setEnrollNotes(scanResult?.notes || '');
    setActiveTab('enroll');
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);
    if (!enrollName.trim() || !enrollPhotoDataUrl) {
      setEnrollError('Name and a reference photo are required.');
      return;
    }
    setEnrolling(true);
    try {
      const fd = new FormData();
      fd.append('name', enrollName.trim());
      fd.append('role', enrollRole.trim());
      fd.append('notes', enrollNotes.trim());
      fd.append('imageDataUrl', enrollPhotoDataUrl);
      await api.addEnrolledPerson(fd);
      await refreshEnrolledFaces();
      setEnrollName('');
      setEnrollRole('');
      setEnrollNotes('');
      setEnrollPhotoDataUrl(null);
      setActiveTab('directory');
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setEnrolling(false);
    }
  };

  if (!visionOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FFFFFF] dark:bg-[#212121] text-[#171717] dark:text-[#F5F5F5]">
      {/* Header */}
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[#E5E5E5] dark:border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <ScanFace className="w-5 h-5 text-[#6366f1]" />
          <h2 className="font-display font-semibold text-base">Vision</h2>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F4F4] dark:bg-[#2A2A2A]">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'camera'
                ? 'bg-[#FFFFFF] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] shadow-sm'
                : 'text-[#717171] dark:text-[#A1A1AA]'
            }`}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enroll')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'enroll'
                ? 'bg-[#FFFFFF] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] shadow-sm'
                : 'text-[#717171] dark:text-[#A1A1AA]'
            }`}
          >
            Enroll person
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'directory'
                ? 'bg-[#FFFFFF] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] shadow-sm'
                : 'text-[#717171] dark:text-[#A1A1AA]'
            }`}
          >
            Enrolled ({enrolledFaces.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setVisionOpen(false)}
          aria-label="Close Vision"
          className="w-9 h-9 rounded-full border border-[#E5E5E5] dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'camera' && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Live Camera Feed */}
            <div className="relative rounded-2xl overflow-hidden border border-[#E5E5E5] dark:border-white/10 bg-[#171717] aspect-video flex items-center justify-center">
              {cameraState === 'denied' ? (
                <div className="p-6 text-center max-w-md space-y-3">
                  <Camera className="w-10 h-10 mx-auto text-[#A1A1AA]" />
                  <div className="text-sm font-medium text-[#F5F5F5]">
                    Camera access is unavailable
                  </div>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Allow camera access in your browser settings to scan faces live, or upload a photo below to identify someone.
                  </p>
                  <button
                    type="button"
                    onClick={() => uploadScanInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-xs font-medium cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload photo to scan</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {cameraState === 'initializing' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#171717]/80 text-[#F5F5F5] gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-[#6366f1]" />
                      <span className="text-xs text-[#A1A1AA]">Starting camera…</span>
                    </div>
                  )}
                  {cameraState === 'active' && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Live feed</span>
                    </div>
                  )}
                </>
              )}

              {scanning && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#6366f1]" />
                  <span className="text-sm font-medium">Analyzing image…</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={cameraState !== 'active' || scanning}
                onClick={() => void handleScanFrame()}
                className="px-6 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-40 text-white text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <ScanFace className="w-4 h-4" />
                <span>{scanning ? 'Scanning…' : 'Scan'}</span>
              </button>

              <button
                type="button"
                disabled={scanning}
                onClick={() => uploadScanInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-sm flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Scan uploaded photo</span>
              </button>

              <input
                ref={uploadScanInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void identifyBlob(file);
                  e.target.value = '';
                }}
              />
            </div>

            {scanError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                {scanError}
              </div>
            )}

            {/* Result Card */}
            {scanResult && (
              <div className="rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] p-5">
                {scanResult.matched ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {scanResult.photoUrl && (
                        <img
                          src={scanResult.photoUrl}
                          alt={scanResult.name || 'Matched person'}
                          className="w-16 h-16 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10 shrink-0"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-display font-semibold text-base">
                            {scanResult.name}
                          </h3>
                          <span className="text-xs font-mono tabular-nums text-emerald-500">
                            {scanResult.confidence}% match
                          </span>
                        </div>
                        {scanResult.role && (
                          <div className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-0.5">
                            {scanResult.role}
                          </div>
                        )}
                        <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1.5">
                          {scanResult.notes}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSaveToMyContacts()}
                      disabled={savedNotice}
                      className="px-4 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] disabled:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {savedNotice ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Saved to My Contacts</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Save to My Contacts</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {scanResult.capturedDataUrl && (
                        <img
                          src={scanResult.capturedDataUrl}
                          alt="Scanned frame"
                          className="w-16 h-16 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10 shrink-0"
                        />
                      )}
                      <div>
                        <h3 className="font-display font-semibold text-base">
                          Person not recognized
                        </h3>
                        <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mt-1">
                          {scanResult.notes}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleEnrollFromNoMatch}
                      className="px-4 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Enroll person</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'enroll' && (
          <div className="max-w-lg mx-auto rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] p-6">
            <h3 className="font-display font-semibold text-lg mb-1">Enroll new person</h3>
            <p className="text-xs text-[#717171] dark:text-[#A1A1AA] mb-5">
              Add a reference photo so Vision can identify this person during scans.
            </p>

            <form onSubmit={(e) => void handleEnrollSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Reference photo
                </label>
                <div className="flex items-center gap-4">
                  {enrollPhotoDataUrl ? (
                    <img
                      src={enrollPhotoDataUrl}
                      alt="Reference preview"
                      className="w-20 h-20 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl border border-dashed border-[#E5E5E5] dark:border-white/20 flex items-center justify-center text-[#717171] dark:text-[#A1A1AA]">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => enrollFileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium cursor-pointer"
                  >
                    Upload photo
                  </button>
                  <input
                    ref={enrollFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setEnrollPhotoDataUrl(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="e.g. Maya Lin"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Role or relationship
                </label>
                <input
                  type="text"
                  value={enrollRole}
                  onChange={(e) => setEnrollRole(e.target.value)}
                  placeholder="e.g. Design Lead"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={enrollNotes}
                  onChange={(e) => setEnrollNotes(e.target.value)}
                  placeholder="Optional details"
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                />
              </div>

              {enrollError && <div className="text-xs text-red-500">{enrollError}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className="px-4 py-2 rounded-xl border border-[#E5E5E5] dark:border-white/10 text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="px-5 py-2 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
                >
                  {enrolling ? 'Saving…' : 'Enroll person'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="max-w-2xl mx-auto">
            {enrolledFaces.length === 0 ? (
              <div className="text-center py-14 space-y-3">
                <ScanFace className="w-10 h-10 mx-auto text-[#717171] dark:text-[#A1A1AA]" />
                <div className="text-sm font-medium">No enrolled people yet</div>
                <p className="text-xs text-[#717171] dark:text-[#A1A1AA]">
                  Enroll someone with a reference photo so Vision can recognize them.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('enroll')}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#6366f1] text-white text-xs font-medium cursor-pointer"
                >
                  Enroll first person
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E5E5] dark:divide-white/10 rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717]">
                {enrolledFaces.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={person.photoUrl}
                        alt={person.name}
                        className="w-12 h-12 rounded-xl object-cover border border-[#E5E5E5] dark:border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{person.name}</div>
                        <div className="text-xs text-[#717171] dark:text-[#A1A1AA] truncate">
                          {person.role || 'Enrolled profile'}
                          {person.lastSeen && (
                            <> · Last seen {new Date(person.lastSeen).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteEnrolledFace(person.id)}
                      aria-label={`Remove ${person.name}`}
                      className="p-2 rounded-lg text-[#717171] dark:text-[#A1A1AA] hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
