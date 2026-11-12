import {
  CalendarDays,
  ChartColumn,
  FlaskConical,
  Inbox,
  Kanban,
  ListChecks,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { canConfigure } from "@/lib/auth/roles";

/**
 * #87 — El modelo del menú, separado del componente que lo pinta.
 *
 * Qué entradas existen lo deciden dos cosas que el nav de cliente no puede
 * leer solo: las banderas de la instancia (`AGENDA`, `CHANNELS`, `ATRIBUCION`,
 * que bajan por prop desde el servidor) y el rol de quien mira. Tenerlo aquí,
 * sin React, deja que una prueba unitaria afirme qué aparece y qué no sin
 * dibujar nada.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Muestra el contador de no leídos (solo la Bandeja). */
  badge?: boolean;
};

export type NavGroup = {
  /** Encabezado pequeño; sin él, el grupo es una entrada suelta. */
  title?: string;
  items: NavItem[];
};

/** La única entrada que va abajo, separada del resto. */
export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "الإعدادات",
  icon: Settings,
};

/**
 * Grupos de la barra lateral, en el orden en que se leen: lo que se atiende
 * cada día, lo que configura al agente y, al final, cómo va el negocio.
 */
export function appNavGroups({
  agenda = false,
  role,
}: {
  /** 015 — "المواعيد" solo existe si esta instancia encendió la agenda. */
  agenda?: boolean;
  /** #86 — La guía de inicio solo para quien puede configurar. */
  role?: string | null;
}): NavGroup[] {
  const trabajo: NavItem[] = [
    { href: "/inbox", label: "صندوق الوارد", icon: Inbox, badge: true },
    { href: "/pipeline", label: "مسار المبيعات", icon: Kanban },
    { href: "/contacts", label: "جهات الاتصال", icon: Users },
  ];
  // Citas va después de Contactos: es el paso siguiente de un trato, no una
  // sección aparte.
  if (agenda) trabajo.push({ href: "/bookings", label: "المواعيد", icon: CalendarDays });

  const agente: NavItem[] = [];
  // Un miembro del equipo no puede hacer ninguno de los pasos de la guía.
  if (canConfigure(role)) {
    agente.push({ href: "/onboarding", label: "دليل البدء", icon: ListChecks });
  }
  agente.push(
    { href: "/agent", label: "المساعد الذكي", icon: Sparkles },
    { href: "/lab", label: "المختبر", icon: FlaskConical }
  );

  return [
    { title: "العمل", items: trabajo },
    { title: "المساعد الذكي", items: agente },
    // 019 — Se mide al final: primero se atiende y se organiza.
    { items: [{ href: "/results", label: "النتائج", icon: ChartColumn }] },
  ];
}

export type SettingsLink = { href: string; label: string };

export type SettingsSection = {
  title: string;
  links: SettingsLink[];
};

/**
 * Ajustes en tres secciones: por dónde entran los mensajes, qué hace el agente
 * con ellos y lo que es del negocio. Una pestaña por canal no escala; una
 * sección por canal, sí: cada canal nuevo cae en "القنوات" sin tocar el resto.
 *
 * Instagram no tiene pantalla propia todavía: sus credenciales se guardan
 * por API (`/api/settings/instagram`). Cuando la tenga, va aquí tras
 * `CHANNELS`, igual que Messenger.
 */
export function settingsSections({
  agenda = false,
  atribucion = false,
  instagram = false,
  messenger = false,
  tiktok = false,
}: {
  agenda?: boolean;
  /** 016 — "الإعلانات" existe solo con la bandera ATRIBUCION. */
  atribucion?: boolean;
  /** 023 — "إنستغرام" solo si el canal está encendido con CHANNELS. */
  instagram?: boolean;
  /** 017 — "ماسنجر", igual. */
  messenger?: boolean;
  /** 022 — "تيك توك", igual: solo con el canal en CHANNELS. */
  tiktok?: boolean;
}): SettingsSection[] {
  const canales: SettingsLink[] = [];
  // 023 — "الحالة" reúne todos los canales; con WhatsApp solo no aporta nada
  // que su pantalla no diga, así que no existe (ADR-001).
  if (instagram || messenger || tiktok) {
    canales.push({ href: "/settings/channels", label: "الحالة" });
  }
  canales.push({ href: "/settings/whatsapp", label: "واتساب" });
  if (instagram) canales.push({ href: "/settings/instagram", label: "إنستغرام" });
  if (messenger) canales.push({ href: "/settings/messenger", label: "ماسنجر" });
  if (tiktok) canales.push({ href: "/settings/tiktok", label: "تيك توك" });

  // #85 — el proveedor de IA se configura aquí; el entorno queda de respaldo.
  const agente: SettingsLink[] = [{ href: "/settings/ai", label: "الذكاء الاصطناعي" }];
  if (agenda) agente.push({ href: "/settings/calendar", label: "جدول المواعيد" });

  const negocio: SettingsLink[] = [
    { href: "/settings/branding", label: "الهوية التجارية" },
    // 062 — Tema, letra, tamaño y densidad (cada quien la suya).
    { href: "/settings/appearance", label: "المظهر" },
    { href: "/settings/templates", label: "القوالب" },
    // 049 — lo que el equipo inserta con «/atajo» en la Bandeja.
    { href: "/settings/quick-replies", label: "الردود السريعة" },
    { href: "/settings/team", label: "الفريق" },
  ];
  if (atribucion) negocio.push({ href: "/settings/ads", label: "الإعلانات" });

  return [
    { title: "القنوات", links: canales },
    { title: "المساعد الذكي", links: agente },
    { title: "النشاط التجاري", links: negocio },
  ];
}

/** Activa si la ruta es la entrada o cuelga de ella (`/inbox/cv_123`). */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
