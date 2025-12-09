const fs = require('fs');
const path = require('path');
let pdf = require('pdf-parse');

// Handle ES default export if present
if (typeof pdf !== 'function' && pdf.default) {
    pdf = pdf.default;
}

const knowledgeDir = path.join(__dirname, 'knowledge');
const outputFile = path.join(knowledgeDir, 'extracted_content.txt');

async function processPdfs() {
    console.log('PDF Parse Library Type:', typeof pdf);

    // Check if pdf is a function before proceeding
    if (typeof pdf !== 'function') {
        console.error('CRITICAL: pdf-parse library did not export a function. It exported:', pdf);
        return;
    }

    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.pdf')).sort(); // Sort to keep order
    let combinedText = '';

    console.log(`Found ${files.length} PDF files.`);

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const filePath = path.join(knowledgeDir, file);
        const dataBuffer = fs.readFileSync(filePath);

        try {
            const data = await pdf(dataBuffer);
            combinedText += `\n\n--- START OF FILE: ${file} ---\n\n`;
            combinedText += data.text;
            combinedText += `\n\n--- END OF FILE: ${file} ---\n\n`;
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }

    fs.writeFileSync(outputFile, combinedText);
    console.log(`All text extracted to ${outputFile}`);
}

processPdfs();
