/**
 * Compress an image file using HTML5 Canvas
 * @param file The original file
 * @param quality Quality from 0 to 1 (default 0.8)
 * @param maxWidth Max width in pixels (default 800)
 * @param maxHeight Max height in pixels (default 800)
 * @returns Promise<File> which is the compressed file
 */
export const compressImage = (
    file: File,
    quality = 0.8,
    maxWidth = 800,
    maxHeight = 800
): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = URL.createObjectURL(file);
        image.onload = () => {
            const canvas = document.createElement('canvas');
            let width = image.width;
            let height = image.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(image.src);
                return reject(new Error('Failed to get canvas context'));
            }

            ctx.drawImage(image, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(image.src);
                    if (!blob) {
                        return reject(new Error('Canvas to Blob failed'));
                    }
                    // Create a new File object with the same name but potentially changed extension (jpeg)
                    const newFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                },
                'image/jpeg',
                quality
            );
        };
        image.onerror = (error) => {
            URL.revokeObjectURL(image.src);
            reject(error);
        };
    });
};
