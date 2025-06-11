export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  console.log('[Telemetry]', eventName, properties);
  // Replace this with actual App Insights SDK later
};