// Format as a readable date/time
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString();
}
