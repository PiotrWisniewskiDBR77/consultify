/**
 * Audio API Tests
 * Tests for audio playback and processing
 *
 * @module tests/audio/audio-player.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Audio player
const createAudioPlayer = () => {
  let currentTrack = null;
  let isPlaying = false;
  let volume = 1;
  let currentTime = 0;
  let duration = 0;
  let playbackRate = 1;
  const playlist = [];
  let currentIndex = -1;
  const listeners = new Map();

  const emit = (event, data) => {
    const handlers = listeners.get(event) || [];
    handlers.forEach((h) => h(data));
  };

  const load = (track) => {
    currentTrack = track;
    currentTime = 0;
    duration = track.duration || 0;
    emit('load', track);
  };

  const play = () => {
    if (!currentTrack) return false;
    isPlaying = true;
    emit('play', currentTrack);
    return true;
  };

  const pause = () => {
    isPlaying = false;
    emit('pause', { currentTime });
  };

  const stop = () => {
    isPlaying = false;
    currentTime = 0;
    emit('stop', {});
  };

  const seek = (time) => {
    currentTime = Math.max(0, Math.min(time, duration));
    emit('seek', { currentTime });
  };

  const setVolume = (v) => {
    volume = Math.max(0, Math.min(1, v));
    emit('volumechange', { volume });
  };

  const setPlaybackRate = (rate) => {
    playbackRate = Math.max(0.25, Math.min(4, rate));
  };

  const setPlaylist = (tracks) => {
    playlist.length = 0;
    playlist.push(...tracks);
    currentIndex = -1;
  };

  const next = () => {
    if (playlist.length === 0) return false;
    currentIndex = (currentIndex + 1) % playlist.length;
    load(playlist[currentIndex]);
    play();
    return true;
  };

  const previous = () => {
    if (playlist.length === 0) return false;
    currentIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
    load(playlist[currentIndex]);
    play();
    return true;
  };

  const on = (event, handler) => {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event).push(handler);
    return () => {
      const handlers = listeners.get(event);
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  };

  return {
    load,
    play,
    pause,
    stop,
    seek,
    setVolume,
    getVolume: () => volume,
    setPlaybackRate,
    getPlaybackRate: () => playbackRate,
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    isPlaying: () => isPlaying,
    getCurrentTrack: () => currentTrack,
    setPlaylist,
    next,
    previous,
    on,
  };
};

// Audio analyser
const createAudioAnalyser = () => {
  let frequencyData = new Uint8Array(256);
  let timeData = new Uint8Array(256);

  return {
    setFrequencyData: (data) => {
      frequencyData = data;
    },

    setTimeData: (data) => {
      timeData = data;
    },

    getFrequencyData: () => [...frequencyData],

    getTimeData: () => [...timeData],

    getAverageFrequency: () => {
      const sum = frequencyData.reduce((a, b) => a + b, 0);
      return sum / frequencyData.length;
    },

    getPeakFrequency: () => {
      let maxIndex = 0;
      let maxValue = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      return { index: maxIndex, value: maxValue };
    },

    getBands: (numBands = 8) => {
      const bandSize = Math.floor(frequencyData.length / numBands);
      const bands = [];

      for (let i = 0; i < numBands; i++) {
        let sum = 0;
        for (let j = 0; j < bandSize; j++) {
          sum += frequencyData[i * bandSize + j];
        }
        bands.push(sum / bandSize);
      }

      return bands;
    },
  };
};

// Audio queue
const createAudioQueue = () => {
  const queue = [];
  let isProcessing = false;
  let currentPlayer = null;

  return {
    enqueue: (track, options = {}) => {
      queue.push({ track, options });
    },

    dequeue: () => {
      return queue.shift();
    },

    process: async (player) => {
      if (isProcessing || queue.length === 0) return;

      isProcessing = true;
      currentPlayer = player;

      while (queue.length > 0) {
        const { track, options } = queue.shift();

        player.load(track);
        if (options.volume !== undefined) {
          player.setVolume(options.volume);
        }
        player.play();

        // Wait for track to finish
        await new Promise((resolve) => {
          const unsub = player.on('stop', resolve);
          // Simulate track end after duration
          setTimeout(
            () => {
              unsub();
              resolve();
            },
            track.duration * 1000 || 1000
          );
        });
      }

      isProcessing = false;
      currentPlayer = null;
    },

    clear: () => {
      queue.length = 0;
    },

    getLength: () => queue.length,

    isProcessing: () => isProcessing,
  };
};

// Sound effect pool
const createSoundPool = (maxSize = 10) => {
  const sounds = new Map();
  const instances = new Map();

  return {
    register: (name, soundData) => {
      sounds.set(name, soundData);
      instances.set(name, []);
    },

    play: (name, options = {}) => {
      const sound = sounds.get(name);
      if (!sound) return null;

      const pool = instances.get(name);

      // Find available instance or create new
      let instance = pool.find((i) => !i.isPlaying);

      if (!instance && pool.length < maxSize) {
        instance = {
          isPlaying: false,
          play: vi.fn(),
          stop: vi.fn(),
        };
        pool.push(instance);
      }

      if (instance) {
        instance.isPlaying = true;
        instance.play();

        // Auto-release
        setTimeout(() => {
          instance.isPlaying = false;
        }, sound.duration || 1000);

        return instance;
      }

      return null;
    },

    stopAll: (name) => {
      const pool = instances.get(name);
      if (pool) {
        pool.forEach((i) => {
          i.stop();
          i.isPlaying = false;
        });
      }
    },

    getActiveCount: (name) => {
      const pool = instances.get(name);
      return pool ? pool.filter((i) => i.isPlaying).length : 0;
    },
  };
};

describe('Audio Player Tests', () => {
  let player;

  beforeEach(() => {
    player = createAudioPlayer();
  });

  it('should load track', () => {
    player.load({ id: 1, title: 'Test', duration: 180 });

    expect(player.getCurrentTrack().title).toBe('Test');
    expect(player.getDuration()).toBe(180);
  });

  it('should play and pause', () => {
    player.load({ id: 1, duration: 60 });

    player.play();
    expect(player.isPlaying()).toBe(true);

    player.pause();
    expect(player.isPlaying()).toBe(false);
  });

  it('should seek', () => {
    player.load({ id: 1, duration: 60 });
    player.seek(30);

    expect(player.getCurrentTime()).toBe(30);
  });

  it('should clamp seek', () => {
    player.load({ id: 1, duration: 60 });
    player.seek(100);

    expect(player.getCurrentTime()).toBe(60);
  });

  it('should set volume', () => {
    player.setVolume(0.5);

    expect(player.getVolume()).toBe(0.5);
  });

  it('should emit events', () => {
    const handler = vi.fn();
    player.on('play', handler);
    player.load({ id: 1 });
    player.play();

    expect(handler).toHaveBeenCalled();
  });

  it('should manage playlist', () => {
    player.setPlaylist([
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
    ]);

    player.next();
    expect(player.getCurrentTrack().title).toBe('A');

    player.next();
    expect(player.getCurrentTrack().title).toBe('B');
  });
});

describe('Audio Analyser Tests', () => {
  let analyser;

  beforeEach(() => {
    analyser = createAudioAnalyser();
    analyser.setFrequencyData(new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]));
  });

  it('should get frequency data', () => {
    const data = analyser.getFrequencyData();

    expect(data).toHaveLength(8);
  });

  it('should get average frequency', () => {
    const avg = analyser.getAverageFrequency();

    expect(avg).toBe(45);
  });

  it('should get peak frequency', () => {
    const peak = analyser.getPeakFrequency();

    expect(peak.index).toBe(7);
    expect(peak.value).toBe(80);
  });

  it('should get bands', () => {
    const bands = analyser.getBands(4);

    expect(bands).toHaveLength(4);
  });
});

describe('Sound Pool Tests', () => {
  let pool;

  beforeEach(() => {
    pool = createSoundPool(5);
    pool.register('click', { duration: 100 });
  });

  it('should play sound', () => {
    const instance = pool.play('click');

    expect(instance).not.toBeNull();
    expect(instance.play).toHaveBeenCalled();
  });

  it('should track active sounds', () => {
    pool.play('click');
    pool.play('click');

    expect(pool.getActiveCount('click')).toBe(2);
  });

  it('should stop all', () => {
    pool.play('click');
    pool.play('click');
    pool.stopAll('click');

    expect(pool.getActiveCount('click')).toBe(0);
  });
});
