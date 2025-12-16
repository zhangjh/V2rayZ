const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function generateIcon() {
    try {
        const inputPath = path.join(__dirname, '../resources/app.png');
        const outputPath = path.join(__dirname, '../build/icon.ico');

        console.log('Generating ICO file from PNG...');
        console.log('Input:', inputPath);
        console.log('Output:', outputPath);

        const buf = await pngToIco(inputPath);
        fs.writeFileSync(outputPath, buf);

        console.log('✓ ICO file generated successfully!');
        console.log('File size:', buf.length, 'bytes');
    } catch (error) {
        console.error('✗ Error generating ICO file:', error);
        process.exit(1);
    }
}

generateIcon();
