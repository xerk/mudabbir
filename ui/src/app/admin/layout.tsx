// The admin area's navigation now lives in the app sidebar (context-aware,
// shown when in /admin/*). This layout is a passthrough; each admin page
// provides its own container/padding.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
