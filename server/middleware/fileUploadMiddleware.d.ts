declare namespace _default {
    export { upload };
    export { fileFilter };
}
export default _default;
/**
 * Multer upload middleware
 */
declare const upload: multer.Multer;
/**
 * File filter - only allow PDF, Excel, Word
 */
declare function fileFilter(req: any, file: any, cb: any): any;
import multer = require("multer");
//# sourceMappingURL=fileUploadMiddleware.d.ts.map