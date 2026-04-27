// Mirrors the role values stored in the DB (User.role String @default("user"))
// A Prisma enum would enforce this at DB level too — worth upgrading later.
export type Role = 'user' | 'admin'
