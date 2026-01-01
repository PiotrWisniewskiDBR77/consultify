/**
 * Video Routes
 * 
 * Handles video serving and management for the help system.
 * Supports both self-hosted videos and external URLs (YouTube, Vimeo).
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Video storage directory
const VIDEO_DIR = path.join(__dirname, '../../public/videos');

/**
 * GET /api/videos/:filename
 * Stream video file
 */
router.get('/:filename', (req, res) => {
    const { filename } = req.params;
    const videoPath = path.join(VIDEO_DIR, filename);
    
    // Security check - prevent path traversal
    if (!videoPath.startsWith(VIDEO_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Video not found' });
    }
    
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    // Support range requests for video seeking
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        
        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
        });
        
        file.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        });
        
        fs.createReadStream(videoPath).pipe(res);
    }
});

/**
 * GET /api/videos
 * List all available videos
 */
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(VIDEO_DIR)) {
            return res.json({ videos: [] });
        }
        
        const files = fs.readdirSync(VIDEO_DIR)
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
            .map(file => ({
                filename: file,
                url: `/api/videos/${file}`,
                size: fs.statSync(path.join(VIDEO_DIR, file)).size
            }));
        
        res.json({ videos: files });
    } catch (error) {
        console.error('[Videos] Error listing videos:', error);
        res.status(500).json({ error: 'Failed to list videos' });
    }
});

/**
 * GET /api/videos/:filename/thumbnail
 * Get video thumbnail
 */
router.get('/:filename/thumbnail', (req, res) => {
    const { filename } = req.params;
    const thumbnailName = filename.replace(/\.(mp4|webm)$/, '.jpg');
    const thumbnailPath = path.join(VIDEO_DIR, 'thumbnails', thumbnailName);
    
    // Check if thumbnail exists
    if (fs.existsSync(thumbnailPath)) {
        res.sendFile(thumbnailPath);
    } else {
        // Return placeholder thumbnail
        const placeholderPath = path.join(__dirname, '../../public/images/video-placeholder.jpg');
        if (fs.existsSync(placeholderPath)) {
            res.sendFile(placeholderPath);
        } else {
            res.status(404).json({ error: 'Thumbnail not found' });
        }
    }
});

/**
 * POST /api/videos/progress
 * Track video watch progress (authenticated)
 */
router.post('/progress', async (req, res) => {
    try {
        const { videoId, progress, completed } = req.body;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Store progress in database (if needed for server-side tracking)
        // For now, client-side localStorage is primary
        
        res.json({ success: true, videoId, progress, completed });
    } catch (error) {
        console.error('[Videos] Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

module.exports = router;


