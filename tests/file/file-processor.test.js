/**
 * File Processor Tests
 * Tests for file processing utilities
 *
 * @module tests/file/file-processor.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// File metadata extractor
const createMetadataExtractor = () => {
  const extractors = new Map();

  // Register common extractors
  extractors.set('image', (file) => ({
    type: 'image',
    width: file.width || 0,
    height: file.height || 0,
    aspectRatio: file.width && file.height ? file.width / file.height : 0,
  }));

  extractors.set('document', (file) => ({
    type: 'document',
    pageCount: file.pageCount || 0,
    wordCount: file.wordCount || 0,
  }));

  extractors.set('video', (file) => ({
    type: 'video',
    duration: file.duration || 0,
    width: file.width || 0,
    height: file.height || 0,
    fps: file.fps || 0,
  }));

  extractors.set('audio', (file) => ({
    type: 'audio',
    duration: file.duration || 0,
    bitrate: file.bitrate || 0,
    sampleRate: file.sampleRate || 0,
  }));

  return {
    register: (type, extractor) => {
      extractors.set(type, extractor);
    },

    extract: (file, type) => {
      const extractor = extractors.get(type);
      if (!extractor) {
        return { type: 'unknown' };
      }
      return extractor(file);
    },

    getType: (filename) => {
      const ext = filename.split('.').pop()?.toLowerCase();
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
      const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
      const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
      const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

      if (imageExts.includes(ext)) return 'image';
      if (docExts.includes(ext)) return 'document';
      if (videoExts.includes(ext)) return 'video';
      if (audioExts.includes(ext)) return 'audio';
      return 'unknown';
    },
  };
};

// File validator
const createFileValidator = () => {
  const rules = {
    maxSize: null,
    allowedTypes: null,
    allowedExtensions: null,
  };

  return {
    maxSize: (bytes) => {
      rules.maxSize = bytes;
      return this;
    },

    allowTypes: (...types) => {
      rules.allowedTypes = types;
      return this;
    },

    allowExtensions: (...extensions) => {
      rules.allowedExtensions = extensions.map((e) => e.toLowerCase().replace('.', ''));
      return this;
    },

    validate: (file) => {
      const errors = [];

      if (rules.maxSize && file.size > rules.maxSize) {
        errors.push({
          type: 'maxSize',
          message: `File size ${file.size} exceeds maximum ${rules.maxSize}`,
        });
      }

      if (rules.allowedTypes && !rules.allowedTypes.includes(file.type)) {
        errors.push({
          type: 'type',
          message: `File type ${file.type} is not allowed`,
        });
      }

      if (rules.allowedExtensions) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!rules.allowedExtensions.includes(ext)) {
          errors.push({
            type: 'extension',
            message: `File extension .${ext} is not allowed`,
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    },

    reset: () => {
      rules.maxSize = null;
      rules.allowedTypes = null;
      rules.allowedExtensions = null;
      return this;
    },
  };
};

// File path utilities
const createPathUtils = () => {
  return {
    basename: (path) => {
      return path.split(/[/\\]/).pop() || '';
    },

    dirname: (path) => {
      const parts = path.split(/[/\\]/);
      parts.pop();
      return parts.join('/') || '.';
    },

    extname: (path) => {
      const basename = path.split(/[/\\]/).pop() || '';
      const dotIndex = basename.lastIndexOf('.');
      return dotIndex > 0 ? basename.slice(dotIndex) : '';
    },

    join: (...parts) => {
      return parts
        .map((p) => p.replace(/^\/|\/$/g, ''))
        .filter(Boolean)
        .join('/');
    },

    normalize: (path) => {
      const parts = path.split(/[/\\]/);
      const result = [];

      for (const part of parts) {
        if (part === '..') {
          result.pop();
        } else if (part !== '.' && part !== '') {
          result.push(part);
        }
      }

      return (path.startsWith('/') ? '/' : '') + result.join('/');
    },

    relative: (from, to) => {
      const fromParts = from.split('/').filter(Boolean);
      const toParts = to.split('/').filter(Boolean);

      let common = 0;
      while (fromParts[common] === toParts[common] && common < fromParts.length) {
        common++;
      }

      const up = fromParts.length - common;
      const down = toParts.slice(common);

      return [...Array(up).fill('..'), ...down].join('/') || '.';
    },

    isAbsolute: (path) => {
      return path.startsWith('/') || /^[a-zA-Z]:\\/.test(path);
    },

    parse: (path) => {
      const base = path.split(/[/\\]/).pop() || '';
      const ext = base.lastIndexOf('.') > 0 ? base.slice(base.lastIndexOf('.')) : '';
      const name = ext ? base.slice(0, -ext.length) : base;

      return {
        dir: path.slice(0, path.length - base.length - 1) || '',
        base,
        ext,
        name,
      };
    },

    format: ({ dir, name, ext }) => {
      return `${dir}${dir ? '/' : ''}${name}${ext}`;
    },
  };
};

describe('File Processor Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // METADATA EXTRACTOR
  // ═══════════════════════════════════════════════════════════════════

  describe('Metadata Extractor', () => {
    let extractor;

    beforeEach(() => {
      extractor = createMetadataExtractor();
    });

    describe('getType', () => {
      it('should detect image type', () => {
        expect(extractor.getType('photo.jpg')).toBe('image');
        expect(extractor.getType('icon.png')).toBe('image');
        expect(extractor.getType('logo.svg')).toBe('image');
      });

      it('should detect document type', () => {
        expect(extractor.getType('report.pdf')).toBe('document');
        expect(extractor.getType('notes.txt')).toBe('document');
      });

      it('should detect video type', () => {
        expect(extractor.getType('movie.mp4')).toBe('video');
        expect(extractor.getType('clip.webm')).toBe('video');
      });

      it('should detect audio type', () => {
        expect(extractor.getType('song.mp3')).toBe('audio');
        expect(extractor.getType('podcast.wav')).toBe('audio');
      });

      it('should return unknown for unknown types', () => {
        expect(extractor.getType('file.xyz')).toBe('unknown');
      });
    });

    describe('extract', () => {
      it('should extract image metadata', () => {
        const file = { width: 1920, height: 1080 };
        const metadata = extractor.extract(file, 'image');

        expect(metadata.width).toBe(1920);
        expect(metadata.aspectRatio).toBeCloseTo(1.78, 1);
      });

      it('should extract video metadata', () => {
        const file = { duration: 120, fps: 30 };
        const metadata = extractor.extract(file, 'video');

        expect(metadata.duration).toBe(120);
        expect(metadata.fps).toBe(30);
      });
    });

    describe('register', () => {
      it('should register custom extractor', () => {
        extractor.register('custom', (file) => ({ custom: true, data: file.data }));

        const metadata = extractor.extract({ data: 'test' }, 'custom');

        expect(metadata.custom).toBe(true);
        expect(metadata.data).toBe('test');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILE VALIDATOR
  // ═══════════════════════════════════════════════════════════════════

  describe('File Validator', () => {
    let validator;

    beforeEach(() => {
      validator = createFileValidator();
    });

    describe('maxSize', () => {
      it('should validate file size', () => {
        validator.maxSize(1000);

        expect(validator.validate({ size: 500, name: 'test.txt' }).valid).toBe(true);
        expect(validator.validate({ size: 1500, name: 'test.txt' }).valid).toBe(false);
      });
    });

    describe('allowTypes', () => {
      it('should validate file type', () => {
        validator.allowTypes('image/jpeg', 'image/png');

        expect(validator.validate({ type: 'image/jpeg', name: 'test.jpg', size: 100 }).valid).toBe(
          true
        );
        expect(
          validator.validate({ type: 'application/pdf', name: 'test.pdf', size: 100 }).valid
        ).toBe(false);
      });
    });

    describe('allowExtensions', () => {
      it('should validate file extension', () => {
        validator.allowExtensions('.jpg', '.png');

        expect(validator.validate({ name: 'image.jpg', size: 100 }).valid).toBe(true);
        expect(validator.validate({ name: 'doc.pdf', size: 100 }).valid).toBe(false);
      });
    });

    describe('combined rules', () => {
      it('should validate all rules', () => {
        validator.maxSize(1000).allowTypes('image/jpeg').allowExtensions('.jpg');

        const valid = { name: 'photo.jpg', size: 500, type: 'image/jpeg' };
        const invalid = { name: 'photo.png', size: 2000, type: 'image/png' };

        expect(validator.validate(valid).valid).toBe(true);
        expect(validator.validate(invalid).errors.length).toBe(3);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PATH UTILS
  // ═══════════════════════════════════════════════════════════════════

  describe('Path Utils', () => {
    let pathUtils;

    beforeEach(() => {
      pathUtils = createPathUtils();
    });

    describe('basename', () => {
      it('should get basename', () => {
        expect(pathUtils.basename('/path/to/file.txt')).toBe('file.txt');
        expect(pathUtils.basename('file.txt')).toBe('file.txt');
      });
    });

    describe('dirname', () => {
      it('should get dirname', () => {
        expect(pathUtils.dirname('/path/to/file.txt')).toBe('/path/to');
      });
    });

    describe('extname', () => {
      it('should get extension', () => {
        expect(pathUtils.extname('/path/to/file.txt')).toBe('.txt');
        expect(pathUtils.extname('file')).toBe('');
      });
    });

    describe('join', () => {
      it('should join paths', () => {
        expect(pathUtils.join('/path', 'to', 'file.txt')).toBe('path/to/file.txt');
      });
    });

    describe('normalize', () => {
      it('should normalize path', () => {
        expect(pathUtils.normalize('/path/to/../file.txt')).toBe('/path/file.txt');
        expect(pathUtils.normalize('./a/./b/../c')).toBe('a/c');
      });
    });

    describe('relative', () => {
      it('should get relative path', () => {
        expect(pathUtils.relative('/a/b/c', '/a/d/e')).toBe('../../d/e');
      });
    });

    describe('isAbsolute', () => {
      it('should check if absolute', () => {
        expect(pathUtils.isAbsolute('/path/to/file')).toBe(true);
        expect(pathUtils.isAbsolute('path/to/file')).toBe(false);
      });
    });

    describe('parse / format', () => {
      it('should parse and format path', () => {
        const parsed = pathUtils.parse('/path/to/file.txt');

        expect(parsed.dir).toBe('/path/to');
        expect(parsed.base).toBe('file.txt');
        expect(parsed.ext).toBe('.txt');
        expect(parsed.name).toBe('file');

        expect(pathUtils.format(parsed)).toBe('/path/to/file.txt');
      });
    });
  });
});
