export const getJsonValueFromMessage = (message) => {
  try {
    const value = message?.value?.toString();
    return JSON.parse(value);
  } catch {
    return {};
  }
};
