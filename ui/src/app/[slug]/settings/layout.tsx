import { SettingsTabs } from "@/components/layout/SettingsTabs";

// Workspace settings keep the main workspace sidebar. The settings sub-nav
// (General / Members / Teams / Regional) lives here as tabs.
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
