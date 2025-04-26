'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

const EMOJI_MAP: Record<string, string> = {
  happy: '😄',
  sad: '😢',
  angry: '😠',
  surprised: '😲',
  disgusted: '🤢',
  fearful: '😨',
  neutral: '😐',
};

const COLORS: Record<string, string> = {
  happy: '#FFD700',
  sad: '#1E90FF',
  angry: '#FF4500',
  surprised: '#9370DB',
  disgusted: '#32CD32',
  fearful: '#FF69B4',
  neutral: '#A9A9A9',
};

const EmotionDetector: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentEmoji, setCurrentEmoji] = useState<string | null>(null);
  const emotionBuffer = useRef<string[]>([]);
  const summaryBuffer = useRef<Record<string, number>>({
    happy: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    disgusted: 0,
    fearful: 0,
    neutral: 0,
  });

  useEffect(() => {
    const MODEL_URL = '/models';

    const loadModels = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      console.log('✅ face-api.js models loaded');
    };

    const detectEmotions = async (videoEl: HTMLVideoElement) => {
      const displaySize = {
        width: videoEl.videoWidth,
        height: videoEl.videoHeight,
      };

      if (!canvasRef.current) return;
      faceapi.matchDimensions(canvasRef.current, displaySize);

      setInterval(async () => {
        if (!canvasRef.current) return;

        const detections = await faceapi
          .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const resized = faceapi.resizeResults(detections, displaySize);

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvasRef.current.width, 0);

        // faceapi.draw.drawDetections(canvasRef.current, resized);
        faceapi.draw.drawFaceExpressions(canvasRef.current, resized);

        ctx.restore();

        if (detections.length > 0) {
          const expressions = detections[0].expressions;

          const topEmotion = Object.entries(expressions)
            .sort((a, b) => b[1] - a[1])[0][0];

          emotionBuffer.current.push(topEmotion);
          if (emotionBuffer.current.length > 20) {
            emotionBuffer.current.shift();
          }

          if (summaryBuffer.current[topEmotion] !== undefined) {
            summaryBuffer.current[topEmotion] += 1;
          }

          const mostCommon = mode(emotionBuffer.current);
          const count = emotionBuffer.current.filter(e => e === mostCommon).length;

          if (count > 15 && EMOJI_MAP[mostCommon]) {
            setCurrentEmoji(EMOJI_MAP[mostCommon]);
            setTimeout(() => setCurrentEmoji(null), 2000);
            emotionBuffer.current = [];
          }
        }
      }, 500);
    };

    const mode = (arr: string[]): string => {
      const freq: Record<string, number> = {};
      arr.forEach((e) => (freq[e] = (freq[e] || 0) + 1));
      return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    };

    const run = async () => {
      await loadModels();

      const observer = new MutationObserver(() => {
        const videoEl = document.querySelector('video');
        if (videoEl && videoEl.videoWidth > 0) {
          detectEmotions(videoEl as HTMLVideoElement);
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    };

    run();
  }, []);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
      {currentEmoji && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-6xl animate-bounce">
          {currentEmoji}
        </div>
      )}

      {/* 🧠 Live Emotion Summary Text */}
      <div className="absolute bottom-2 left-2 bg-white/90 p-3 rounded-xl shadow-md text-black text-sm space-y-1 pointer-events-auto">
        <div className="font-bold text-center">Guest Reactions</div>
        {Object.entries(summaryBuffer.current).map(([emotion, count]) => (
          <div key={emotion} className="flex items-center gap-2">
            <span>{EMOJI_MAP[emotion]}</span>
            <span className="capitalize">{emotion}</span>: <span>{count}</span>
          </div>
        ))}
      </div>

      {/* 📊 Pie Chart for Emotions */}
      <div className="absolute bottom-2 right-2 bg-white/90 p-3 rounded-xl shadow-md text-black pointer-events-auto">
        <div className="font-bold text-center mb-2 text-sm">Guest Reactions</div>
        <PieChart width={200} height={200}>
          <Pie
            data={Object.entries(summaryBuffer.current).map(([emotion, count]) => ({
              name: emotion,
              value: count,
            })).filter(entry => entry.value > 0)}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name }) => EMOJI_MAP[name]}
          >
            {Object.keys(summaryBuffer.current).map((emotion, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[emotion]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </div>
    </div>
  );
};

export default EmotionDetector;
