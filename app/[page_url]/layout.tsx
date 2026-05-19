export default function PublicPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout ensures the preview page is rendered without admin sidebar/header
  // It completely isolates the preview page from any admin layout
  return (
    <div className="min-h-screen w-full bg-black overflow-x-hidden overflow-y-visible" style={{ margin: 0, padding: 0 }}>
      {children}
    </div>
  );
}

