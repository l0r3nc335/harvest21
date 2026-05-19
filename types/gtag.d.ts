interface Window {
  gtag: (
    command: 'config' | 'event',
    targetId: string,
    config?: Record<string, any>
  ) => void;
  dataLayer: any[];
}
