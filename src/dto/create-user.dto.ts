import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1, 'name must not be empty'),
  email: z.string().email('email must be a valid email'),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
