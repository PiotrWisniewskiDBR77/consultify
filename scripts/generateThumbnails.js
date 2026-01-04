#!/usr/bin/env node
/**
 * Video Thumbnail Generator
 * 
 * Generates thumbnail images from video files using FFmpeg.
 * Run: node scripts/generateThumbnails.js
 * 
 * Prerequisites:
 * - FFmpeg must be installed (brew install ffmpeg / apt install ffmpeg)
 * - Videos must be in public/videos/ directory
 * 
 * Output:
 * - Thumbnails saved to public/videos/thumbnails/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const VIDEO_DIR = path.join(__dirname, '../public/videos');
const THUMBNAIL_DIR = path.join(VIDEO_DIR, 'thumbnails');
const THUMBNAIL_TIME = '00:00:03'; // Capture frame at 3 seconds
const THUMBNAIL_WIDTH = 640; // Width in pixels (height auto-scaled)
const SUPPORTED_FORMATS = ['.mp4', '.webm', '.mov', '.avi'];

// Ensure thumbnail directory exists
if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
    console.log(`✅ Created thumbnail directory: ${THUMBNAIL_DIR}`);
}

// Check if FFmpeg is installed
function checkFFmpeg() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch {
        console.error('❌ FFmpeg is not installed. Please install it first:');
        console.error('   macOS: brew install ffmpeg');
        console.error('   Ubuntu: sudo apt install ffmpeg');
        console.error('   Windows: choco install ffmpeg');
        return false;
    }
}

// Generate thumbnail for a single video
function generateThumbnail(videoPath) {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${videoName}.jpg`);
    
    // Skip if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
        console.log(`⏭️  Skipping ${videoName} (thumbnail exists)`);
        return { status: 'skipped', file: videoName };
    }
    
    try {
        // FFmpeg command to extract frame and create thumbnail
        const command = `ffmpeg -i "${videoPath}" -ss ${THUMBNAIL_TIME} -vframes 1 -vf "scale=${THUMBNAIL_WIDTH}:-1" -q:v 2 "${thumbnailPath}" -y`;
        
        execSync(command, { stdio: 'ignore' });
        console.log(`✅ Generated thumbnail for ${videoName}`);
        return { status: 'success', file: videoName };
    } catch (error) {
        console.error(`❌ Failed to generate thumbnail for ${videoName}:`, error.message);
        return { status: 'error', file: videoName, error: error.message };
    }
}

// Generate placeholder thumbnail (if video doesn't exist yet)
function generatePlaceholder() {
    const placeholderPath = path.join(__dirname, '../public/images/video-placeholder.jpg');
    
    if (fs.existsSync(placeholderPath)) {
        console.log('⏭️  Placeholder already exists');
        return;
    }
    
    // Create a simple placeholder using ImageMagick if available
    try {
        execSync('convert -version', { stdio: 'ignore' });
        const command = `convert -size ${THUMBNAIL_WIDTH}x360 xc:#1e293b -gravity center -font Arial -pointsize 24 -fill white -annotate 0 "Video Coming Soon" "${placeholderPath}"`;
        execSync(command, { stdio: 'ignore' });
        console.log('✅ Generated placeholder thumbnail');
    } catch {
        console.log('ℹ️  ImageMagick not available for placeholder generation');
        console.log('   Install with: brew install imagemagick');
    }
}

// Main function
function main() {
    console.log('🎬 Video Thumbnail Generator\n');
    
    // Check FFmpeg
    if (!checkFFmpeg()) {
        process.exit(1);
    }
    
    // Check if video directory exists
    if (!fs.existsSync(VIDEO_DIR)) {
        console.log(`📁 Creating video directory: ${VIDEO_DIR}`);
        fs.mkdirSync(VIDEO_DIR, { recursive: true });
        console.log('\nNo videos found. Add videos to public/videos/ and run again.');
        generatePlaceholder();
        return;
    }
    
    // Get all video files
    const files = fs.readdirSync(VIDEO_DIR).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return SUPPORTED_FORMATS.includes(ext);
    });
    
    if (files.length === 0) {
        console.log('No video files found in', VIDEO_DIR);
        console.log('Supported formats:', SUPPORTED_FORMATS.join(', '));
        generatePlaceholder();
        return;
    }
    
    console.log(`Found ${files.length} video(s)\n`);
    
    // Generate thumbnails
    const results = {
        success: 0,
        skipped: 0,
        error: 0
    };
    
    files.forEach(file => {
        const result = generateThumbnail(path.join(VIDEO_DIR, file));
        results[result.status]++;
    });
    
    // Generate placeholder for missing videos
    generatePlaceholder();
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Generated: ${results.success}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Errors: ${results.error}`);
}

// Run
main();











