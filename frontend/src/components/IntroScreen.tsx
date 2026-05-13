import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IntroScreenProps {
  onComplete: () => void;
}

export default function IntroScreen({ onComplete }: IntroScreenProps) {
  const [videoEnded, setVideoEnded] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure we move to the main app after 8 seconds (video duration)
    const timer = setTimeout(() => {
      if (!videoEnded) {
        setVideoEnded(true);
        onComplete();
      }
    }, 8000);

    // Try to play the video
    const playVideo = async () => {
      if (videoRef.current) {
        try {
          // First try muted autoplay
          videoRef.current.muted = true;
          await videoRef.current.play();
          
          // If successful, show play button for user to enable sound
          if (!userInteracted) {
            setShowPlayButton(true);
          }
        } catch (error) {
          console.error('Video playback error:', error);
          // If even muted autoplay fails, show play button
          setShowPlayButton(true);
        }
      }
    };

    playVideo();

    return () => clearTimeout(timer);
  }, [onComplete, videoEnded, userInteracted]);

  const handleVideoEnd = () => {
    setVideoEnded(true);
    onComplete();
  };

  const handlePlayClick = async () => {
    if (videoRef.current) {
      try {
        setUserInteracted(true);
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
        
        // If video is paused, play it
        if (videoRef.current.paused) {
          await videoRef.current.play();
        }
        
        setShowPlayButton(false);
      } catch (error) {
        console.error('Manual play error:', error);
      }
    }
  };

  return (
    <AnimatePresence>
      {!videoEnded && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black flex items-center justify-center z-50"
        >
          <div className="absolute inset-0 w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={handleVideoEnd}
              onPlay={() => {
                console.log('Video started playing');
              }}
              className="w-full h-full object-cover"
            >
              <source src="/Jarvis_AI_Initialization_Video_Ready.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Play button overlay */}
          {showPlayButton && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
              <button
                onClick={handlePlayClick}
                className="bg-white/20 hover:bg-white/30 rounded-full p-8 transition-all duration-300 hover:scale-110"
              >
                <svg
                  className="w-16 h-16 text-white ml-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}

          <button
            onClick={handleVideoEnd}
            className="absolute bottom-8 right-8 text-white/50 hover:text-white z-10 px-4 py-2 rounded transition-colors"
          >
            Skip Intro
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

 