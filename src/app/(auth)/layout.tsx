import { DEFAULT_BRANDING } from "@/lib/branding";
import { getBranding } from "@/server/branding";
import { BrandLogo } from "@/components/brand-mark";

/**
 * Pantalla de entrada con la escenografía del hero de vocerocrm.com: papel
 * frío, rejilla difuminada y dos resplandores (azul y cian) detrás del
 * formulario. Con la marca Vocero se remata con el titular de la landing; una
 * instancia white-label ve su nombre y una descripción neutra.
 */
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getBranding().catch(() => DEFAULT_BRANDING);
  return (
    <main lang="ar" dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-subtle p-4 font-tajawal">
      <div className="brand-grid absolute inset-0" aria-hidden />
      <div className="brand-glow brand-glow-a" aria-hidden />
      <div className="brand-glow brand-glow-b" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo branding={branding} size="lg" />
          <div>
            <h1 className="text-[24px] font-bold leading-tight tracking-tight">
              إدارة محادثاتك ومبيعاتك
            </h1>
            <p className="mt-2 text-sm text-text-3">
              منصة MatjarnaCOD لإدارة العملاء والتواصل بذكاء
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
