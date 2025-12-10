// scripts/process_videos.js
// Simple Node.js script to convert a source video into MP4 (H.264) and WebM using ffmpeg.
// Usage: node scripts/process_videos.js <inputFile> <langCode>
// It will output files to public/videos/<langCode>.mp4 and .webm

const { execSync } = require('child_process');
const path = require('path');

if (process.argv.length < 4) {
    console.error('Usage: node process_videos.js <inputFile> <langCode>');
    process.exit(1);
}

const inputFile = process.argv[2];
const lang = process.argv[3].toLowerCase();
const outputDir = path.resolve(__dirname, '..', 'public', 'videos');
const mp4Out = path.join(outputDir, `${lang}.mp4`);
const webmOut = path.join(outputDir, `${lang}.webm`);

// Ensure output directory exists
execSync(`mkdir -p "${outputDir}"`);

console.log(`Processing ${inputFile} for language ${lang}`);

// Convert to MP4 (H.264)
execSync(`ffmpeg -i "${inputFile}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${mp4Out}"`);

// Convert to WebM
execSync(`ffmpeg -i "${inputFile}" -c:v libvpx-vp9 -b:v 0 -crf 30 -c:a libopus "${webmOut}"`);

console.log('Generated:', mp4Out, webmOut);
