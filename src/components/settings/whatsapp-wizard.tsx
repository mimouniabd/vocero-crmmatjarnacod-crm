"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmbeddedSignup } from "./embedded-signup";
import { EntregasCard } from "./entregas-card";

type Connection = {
  wabaId: string;
  messagingAccountId: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
};

type WebhookInfo = {
  url: string;
  verifyToken: string;
  isHttps: boolean;
  signatureLayer: boolean;
};

/** Lo que devuelve el registro del webhook en Meta (al guardar o a demanda). */
type WebhookRegistration =
  | { ok: true; appWithoutWebhook: boolean; messagingAccount?: MessagingAccountRegistration }
  | { ok: true; skipped: "waba_override"; host: string }
  | { ok: false; message: string };

/** 065 — El registro en la Cuenta de mensajes, aparte del del número. */
type MessagingAccountRegistration =
  | { ok: true; skipped?: "override_ajeno"; host?: string }
  | { ok: false; message: string };

/**
 * El último registro, y desde dónde se pidió. Uno solo para las dos tarjetas:
 * con uno por tarjeta, guardar con un token sin permiso dejaba el «registrado»
 * de un clic anterior al lado del aviso nuevo.
 */
type LastRegistration = {
  result: WebhookRegistration;
  from: "save" | "button" | "embedded";
};

export function WhatsappWizard() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [registration, setRegistration] = useState<LastRegistration | null>(
    null
  );

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/whatsapp").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) setConnection(c.connection);
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-[12rem] flex-1">
            <p className="font-medium text-danger-text">
              انتهت صلاحية رمز واتساب أو تم إلغاؤه.
            </p>
            <p className="text-danger-text opacity-80">
              Los envíos están pausados. Pega un token nuevo abajo y prueba la
              conexión para reconectar.
            </p>
          </div>
          <Desconectar
            onHecho={() => {
              setRegistration(null);
              void refetch();
            }}
          />
        </div>
      )}

      {connection && connection.status === "connected" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success-soft bg-success-tint p-4">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <div className="min-w-[12rem] flex-1 text-sm">
            <p className="font-medium text-success-text">
              الرقم المتصل: {connection.displayPhoneNumber ?? connection.phoneNumberId}
            </p>
            <p className="text-success-text opacity-80">
              {connection.verifiedName ? `${connection.verifiedName} · ` : ""}
              token …{connection.tokenLast4}
            </p>
          </div>
          <Badge variant="success">متصل</Badge>
          <Desconectar
            onHecho={() => {
              setRegistration(null);
              void refetch();
            }}
          />
        </div>
      )}

      {/* 066 — La conexión oficial con Meta. Sin la app configurada en la
          instancia no se dibuja y queda solo el alta manual de abajo. */}
      <EmbeddedSignup
        onConnected={(r) => {
          setRegistration({ result: r.webhook as WebhookRegistration, from: "embedded" });
          void refetch();
        }}
      />
      {registration?.from === "embedded" && (
        <RegistrationNotice registration={registration.result} afterSave />
      )}

      <ConnectForm
        // 066 — Se rehace si la conexión cambia por «Conectar con Meta»:
        // los campos toman los IDs nuevos.
        key={connection?.phoneNumberId ?? "sin-conexion"}
        existing={connection}
        registration={registration?.from === "save" ? registration.result : null}
        onRegistration={(result) =>
          setRegistration(result ? { result, from: "save" } : null)
        }
        onSaved={() => void refetch()}
      />

      {webhook && (
        <WebhookCard
          webhook={webhook}
          connection={connection}
          registration={registration?.from === "button" ? registration.result : null}
          onRegistration={(result) =>
            setRegistration(result ? { result, from: "button" } : null)
          }
        />
      )}

      {/* 047 — Lo que llegó y no pudo entrar a la bandeja. */}
      {connection && <EntregasCard />}
    </div>
  );
}

/**
 * Soltar el número.
 *
 * Pide confirmación porque corta la entrada y la salida de mensajes al
 * instante — no es un ajuste, es apagar el canal. Lo que NO hace es borrar la
 * bandeja, y el aviso lo dice: sin eso, nadie se atreve a tocarlo.
 */
function Desconectar({ onHecho }: { onHecho: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function desconectar() {
    setYendo(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/whatsapp", { method: "DELETE" });
      if (res.ok) {
        setConfirmando(false);
        onHecho();
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(data?.error?.message ?? "تعذر قطع الاتصال بالرقم.");
      }
    } catch {
      setError("لا يوجد اتصال بالخادم.");
    } finally {
      setYendo(false);
    }
  }

  if (!confirmando) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>
        قطع الاتصال
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        سيتوقف إرسال الرسائل واستقبالها، لكن محادثاتك ستبقى محفوظة.
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={yendo}
        onClick={() => setConfirmando(false)}
      >
        إلغاء
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={yendo}
        onClick={() => void desconectar()}
      >
        {yendo ? "جارٍ قطع الاتصال…" : "نعم، قطع الاتصال"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function ConnectForm({
  existing,
  registration,
  onRegistration,
  onSaved,
}: {
  existing: Connection | null;
  registration: WebhookRegistration | null;
  onRegistration: (result: WebhookRegistration | null) => void;
  onSaved: () => void;
}) {
  const [wabaId, setWabaId] = useState(existing?.wabaId ?? "");
  const [messagingAccountId, setMessagingAccountId] = useState(
    existing?.messagingAccountId ?? ""
  );
  const [phoneNumberId, setPhoneNumberId] = useState(
    existing?.phoneNumberId ?? ""
  );
  const [token, setToken] = useState("");
  const [testResult, setTestResult] = useState<
    | { ok: true; display: string }
    | { ok: false; message: string }
    | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canTest = wabaId.trim() && phoneNumberId.trim() && token.trim();

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/settings/whatsapp/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phoneNumberId, token }),
    }).catch(() => null);
    setTesting(false);
    if (!res) {
      setTestResult({ ok: false, message: "لا يوجد اتصال بالخادم" });
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      displayPhoneNumber?: string;
      error?: { message?: string };
    } | null;
    if (res.ok && data?.displayPhoneNumber) {
      setTestResult({ ok: true, display: data.displayPhoneNumber });
    } else {
      setTestResult({
        ok: false,
        message: data?.error?.message ?? "فشل التحقق",
      });
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    onRegistration(null);
    const res = await fetch("/api/settings/whatsapp", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wabaId,
        phoneNumberId,
        token,
        // 065 — Vacía con una guardada = quitarla; vacía sin guardada = que
        // el servidor intente descubrirla.
        ...(messagingAccountId.trim() || existing?.messagingAccountId
          ? { messagingAccountId: messagingAccountId.trim() }
          : {}),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setSaveError(data?.error?.message ?? "تعذر حفظ الاتصال");
      return;
    }
    const saved = (await res.json().catch(() => null)) as {
      webhook?: WebhookRegistration;
    } | null;
    onRegistration(saved?.webhook ?? null);
    setToken("");
    setTestResult(null);
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existing ? "إعادة ربط الرقم أو تحديثه" : "ربط رقم واتساب"}
        </CardTitle>
        <CardDescription>
          أدخل بيانات WhatsApp Cloud API. يتم التحقق من رمز الوصول لدى Meta قبل حفظه
          وتخزينه مشفراً. عند الحفظ، يتم تسجيل Webhook لدى Meta تلقائياً.
          
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border bg-background p-4 text-sm">
          <p className="font-medium">من أين تحصل على رمز الوصول؟</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium text-primary">الوضع المباشر</p>
              <p className="text-muted-foreground">
                يمتلك النشاط التجاري تطبيقه الخاص على{" "}
                <span className="text-foreground">developers.facebook.com</span>:
                استخدم رمز وصول من نوع <span className="text-foreground">مستخدم النظام</span>{" "}
                (لا تنتهي صلاحيته) مع صلاحيات واتساب. يُنصح أيضاً في هذا الوضع
                بإعداد App Secret للتحقق من توقيع Webhook.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-1 font-medium text-primary">وضع الوكالة (Tech Provider)</p>
              <p className="text-muted-foreground">
                تُجري وكالتك عملية Embedded Signup على منصتها، ويحصل
                الخادم الخاص بها على رمز وصول العميل ثم يزوّدك به
                لتضعه هنا. عند الحفظ، يتم تسجيل Webhook على الرقم
                (<span className="text-foreground">override del número</span>),
                كما في الوضع المباشر. إذا كانت وكالتك توجه الحساب مسبقاً إلى
                خادمها الخاص، فسيتم احترام هذا الإعداد.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="waba-id">WABA ID</Label>
            <Input
              id="waba-id"
              placeholder="معرّف حساب WhatsApp Business"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone-number-id">Phone Number ID</Label>
            <Input
              id="phone-number-id"
              placeholder="معرّف رقم الهاتف"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="messaging-account-id">
            معرّف حساب المراسلة{" "}
            <span className="font-normal text-muted-foreground">(موصى به)</span>
          </Label>
          <Input
            id="messaging-account-id"
            inputMode="numeric"
            placeholder="إعدادات النشاط التجاري › الحسابات › حسابات المراسلة"
            value={messagingAccountId}
            onChange={(e) => setMessagingAccountId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            منذ 2026 تفصل Meta بين حساب واتساب (الرقم)
            وحساب المراسلة (القوالب والمدفوعات). بفضله تُنشأ القوالب
            في الحساب الصحيح ويتم تسجيل Webhook في كليهما.
            إذا تركته فارغاً، سنحاول العثور عليه تلقائياً.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token">رمز الوصول</Label>
          <Input
            id="token"
            type="password"
            placeholder={existing ? `محفوظ (…${existing.tokenLast4}) — أدخل رمزاً جديداً لتغييره` : "EAAG…"}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        {testResult && (
          <p
            className={`text-sm ${testResult.ok ? "text-success" : "text-destructive"}`}
          >
            {testResult.ok
              ? `✓ Token válido para ${testResult.display}. Ya puedes guardar.`
              : testResult.message}
          </p>
        )}
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {registration && (
          <RegistrationNotice registration={registration} afterSave />
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!canTest || testing}
            onClick={() => void test()}
          >
            {testing ? "جارٍ الاختبار…" : "اختبار الاتصال"}
          </Button>
          <Button
            disabled={!testResult?.ok || saving}
            onClick={() => void save()}
          >
            {saving ? "جارٍ الحفظ…" : "حفظ الاتصال"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * El resultado de registrar el webhook en Meta, en palabras de quien lo lee.
 *
 * Un fallo aquí NO deshace el guardado: el token es válido y la conexión
 * envía. Por eso el aviso es de advertencia, no de error, y dice qué hacer.
 */
function RegistrationNotice({
  registration,
  afterSave = false,
}: {
  registration: WebhookRegistration;
  afterSave?: boolean;
}) {
  if (registration.ok && "messagingAccount" in registration && registration.messagingAccount) {
    const { messagingAccount, ...delNumero } = registration;
    return (
      <div className="space-y-2">
        <RegistrationNotice registration={delNumero} afterSave={afterSave} />
        <MessagingAccountNotice result={messagingAccount} />
      </div>
    );
  }
  if (registration.ok && "skipped" in registration) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          حساب واتساب لديك يوجه Webhook بالفعل إلى{" "}
          <span className="text-foreground">{registration.host}</span> (un
          cerebro externo o el backend de tu agencia). Se respeta: el número
          دون Webhook خاص، وستستمر الرسائل بالوصول إلى هناك.
        </span>
      </p>
    );
  }
  if (registration.ok && !registration.appWithoutWebhook) {
    return (
      <p className="flex items-start gap-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        تم تسجيل Webhook لدى Meta: ستصل رسائل هذا الرقم إلى هنا.
        لا حاجة لإدخال أي شيء يدوياً في لوحة تطبيقك.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {registration.ok ? (
          <>
            تم تسجيل Webhook على الرقم، لكن Meta لا تعرض أي
            Webhook في تطبيقك. إذا لم تصل الرسائل، افتح developers.facebook.com
            → تطبيقك → WhatsApp → الإعدادات، وتحقق من Callback URL
            (يمكن استخدام الرابط أدناه) واشترك في الحقل{" "}
            <code>messages</code>. يتم ذلك مرة واحدة لكل تطبيق.
          </>
        ) : (
          <>
            {afterSave ? "تم حفظ الاتصال، لكن تعذر" : "تعذر"} تسجيل Webhook لدى Meta. {registration.message} أعد المحاولة باستخدام
            «التسجيل لدى Meta» أو أدخل الرابط ورمز التحقق يدوياً.
          </>
        )}
      </span>
    </p>
  );
}

/** 065 — Cómo quedó el webhook en la Cuenta de mensajes del split de 2026. */
function MessagingAccountNotice({ result }: { result: MessagingAccountRegistration }) {
  if (result.ok && result.skipped) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          حساب المراسلة لديك يوجه Webhook بالفعل إلى{" "}
          <span className="text-foreground">{result.host}</span>. سنحترم هذا الإعداد.
        </span>
      </p>
    );
  }
  if (result.ok) {
    return (
      <p className="flex items-start gap-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        تم تسجيل Webhook أيضاً في حساب المراسلة.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {result.message} بدون ذلك، قد لا تصل الرسائل الواردة في حسابات Meta
        التي تم فصلها حديثاً.
      </span>
    </p>
  );
}

function WebhookCard({
  webhook,
  connection,
  registration,
  onRegistration,
}: {
  webhook: WebhookInfo;
  connection: Connection | null;
  registration: WebhookRegistration | null;
  onRegistration: (result: WebhookRegistration | null) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const canRegister = connection?.status === "connected";

  async function register(recuperar = false) {
    if (recuperar) {
      const host = registration?.ok && "skipped" in registration ? registration.host : "otro servicio";
      const ok = window.confirm(
        `استعادة Webhook: ستتوقف رسائل رقمك عن الوصول إلى ${host} وستصل إلى هذا النظام ليحوّلها إلى مساعدك. هل تريد المتابعة؟`
      );
      if (!ok) return;
    }
    setRegistering(true);
    onRegistration(null);
    const res = await fetch("/api/settings/webhook", {
      method: "POST",
      ...(recuperar
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ recuperar: true }) }
        : {}),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | (WebhookRegistration & { error?: { message?: string } })
      | null;
    setRegistering(false);
    if (res?.ok && data?.ok) {
      onRegistration(data);
    } else {
      onRegistration({
        ok: false,
        message: data?.error?.message ?? "لا يوجد اتصال بالخادم.",
      });
    }
  }

  function copy(text: string, which: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook واتساب</CardTitle>
        <CardDescription>
          Al guardar la conexión, esta dirección se registra en Meta por ti, en
          el número (override). Estos valores son para el backend de tu agencia
          o para pegarlos a mano en el panel de Meta solo si el registro
          automático falla.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canRegister && (
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              disabled={registering}
              onClick={() => void register(false)}
            >
              {registering ? "جارٍ التسجيل…" : "التسجيل لدى Meta"}
            </Button>
            {registration && <RegistrationNotice registration={registration} />}
            {/* 035 — Quien venía con Nea 1.x delante del CRM: el webhook vive en
                un override ajeno de la WABA y el registro normal lo respeta. */}
            {registration?.ok && "skipped" in registration && (
              <Button
                variant="outline"
                size="sm"
                disabled={registering}
                onClick={() => void register(true)}
              >
                استعادة Webhook
              </Button>
            )}
          </div>
        )}
        {!webhook.isHttps && (
          <p className="flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-3 text-xs text-warning-text">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            La URL configurada no es https: Meta exige https para los webhooks.
            Ajusta APP_BASE_URL con tu dominio público.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>رابط Webhook (Callback URL)</Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-xs">
              {webhook.url}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="نسخ الرابط"
              onClick={() => copy(webhook.url, "url")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copied === "url" && (
              <span className="text-xs text-primary">تم النسخ ✓</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            يحتوي الرابط على رمز سري ضمن المسار؛ تعامل معه
            ككلمة مرور.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>رمز التحقق</Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-xs">
              {webhook.verifyToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="نسخ رمز التحقق"
              onClick={() => copy(webhook.verifyToken, "vt")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copied === "vt" && (
              <span className="text-xs text-primary">تم النسخ ✓</span>
            )}
          </div>
        </div>
        {webhook.signatureLayer ? (
          <p className="flex items-center gap-2 text-xs text-success">
            <ShieldCheck className="h-4 w-4" /> التحقق من التوقيع مفعّل
            (META_APP_SECRET مُعدّ): يتم التحقق من كل حدث باستخدام
            x-hub-signature-256.
          </p>
        ) : (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> لا يوجد App Secret
            مُعدّ: تتم حماية Webhook بالرابط السري (وهذا معتاد
            في وضع الوكالة). لإضافة طبقة تحقق أخرى، أضف
            META_APP_SECRET إلى إعدادات المنصة.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
