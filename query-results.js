export function queryRows(result, label, optional = false) {
  const response = result.status === "rejected" ? { error: result.reason } : result.value;
  if (Array.isArray(response)) return response;

  if (response?.error) {
    if (optional) {
      console.warn(`Unable to load optional ${label}.`, response.error);
      return [];
    }
    throw response.error;
  }

  return response?.data || [];
}
