import { z } from 'zod';

/**
 * Body of a PATCH request: any of the fields, at least one of them. A field left out keeps its
 * value, so the fields must not have defaults.
 */
export function updateSchema<T extends z.ZodRawShape>(shape: T) {
    return z
        .object(shape)
        .partial()
        .refine(
            (changes) => Object.values(changes).some((v) => v !== undefined),
            'Nothing to update',
        );
}
