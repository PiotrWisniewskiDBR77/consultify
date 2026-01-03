const { z } = require('zod');

/**
 * Higher-order function to validate request body against a Zod schema.
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 */
const validateBody = (schema) => (req, res, next) => {
    try {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            // Format Zod errors into a readable structure
            const errors = result.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code
            }));

            return res.status(400).json({
                error: 'Validation Error',
                details: errors
            });
        }

        // Replace body with parsed (sanitized/coerced) data
        req.body = result.data;
        next();
    } catch (error) {
        console.error('Validation Middleware Error:', error);
        return res.status(500).json({ error: 'Internal Server Error during validation' });
    }
};

export default { validateBody };
