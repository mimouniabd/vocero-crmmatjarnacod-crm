"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/**
 * Switches the active workspace using Better Auth's organization plugin.
 * The server remains responsible for validating membership and scoping data.
 */
export function OrganizationSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { data: organizations, isPending } = authClient.useListOrganizations();
  const { data: session } = authClient.useSession();
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");

  const activeId = session?.session.activeOrganizationId ?? "";
  const list = organizations ?? [];

  async function changeOrganization(organizationId: string) {
    if (!organizationId || organizationId === activeId || changing) return;
    setChanging(true);
    setError("");
    try {
      const result = await authClient.organization.setActive({ organizationId });
      if (result.error) {
        setError("تعذر تبديل مساحة العمل. حاول مرة أخرى.");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذر تبديل مساحة العمل. حاول مرة أخرى.");
    } finally {
      setChanging(false);
    }
  }

  if (isPending || list.length === 0) {
    return (
      <div className={compact ? "px-2.5 py-2 text-xs text-text-3" : "px-2 py-2 text-xs text-text-3"}>
        {isPending ? "جارٍ تحميل مساحات العمل..." : "لا توجد مساحة عمل متاحة"}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1 px-2.5 py-2" : "space-y-1"}>
      <label className="block text-[11px] font-medium text-text-3" htmlFor="active-workspace">
        مساحة العمل
      </label>
      <select
        id="active-workspace"
        aria-label="تبديل مساحة العمل"
        value={activeId}
        disabled={changing || list.length < 2}
        onChange={(event) => void changeOrganization(event.target.value)}
        className="h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
      >
        {list.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      {changing && <p className="text-[11px] text-text-3">جارٍ التبديل...</p>}
      {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
