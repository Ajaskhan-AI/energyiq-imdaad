import type { Actor, User } from '../types'

/** The "who" stamp recorded on every action a logged-in user takes. */
export function actorFromUser(user: User): Actor {
  return { name: user.name, role: user.role, userId: user.id }
}
