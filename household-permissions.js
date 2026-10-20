export function hasHouseholdOwnerRole(members, userId) {
  return Boolean(userId && members.some(member => member.user_id === userId && member.role === "owner"));
}
