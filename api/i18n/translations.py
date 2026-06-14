"""Translation catalog and locale resolution helpers.

The catalog maps the **exact English message string** (as written at the
``raise HTTPException(detail=...)`` sites) to a per-locale dict. English is the
default and always returns the original string; Arabic ("ar") returns the
localized text. Messages not present here fall back to the original English
string, so adding a new ``raise`` site never breaks — it simply stays English
until a translation is added.
"""

from contextvars import ContextVar
from typing import Mapping

# Default locale used when nothing else is resolved.
DEFAULT_LOCALE = "en"

# Per-request locale. Set by the middleware in ``api.app`` and read by the
# HTTPException handler. Defaults to English so any code path that runs outside
# a request (workers, tasks) behaves exactly as before.
current_locale: ContextVar[str] = ContextVar("current_locale", default=DEFAULT_LOCALE)


# English message -> {locale: translated message}. English entries mirror the
# source strings so a hit always returns a value; the fallback in ``translate``
# covers anything missing.
TRANSLATIONS: dict[str, dict[str, str]] = {
    # --- Auth: signup / login / credentials (api/routes/auth.py) ---
    "Email already registered": {
        "en": "Email already registered",
        "ar": "البريد الإلكتروني مسجّل بالفعل",
    },
    "Invalid email or password": {
        "en": "Invalid email or password",
        "ar": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    },
    "Session expired": {
        "en": "Session expired",
        "ar": "انتهت صلاحية الجلسة",
    },
    "Invalid session token": {
        "en": "Invalid session token",
        "ar": "رمز الجلسة غير صالح",
    },
    "Invalid or expired token": {
        "en": "Invalid or expired token",
        "ar": "الرمز غير صالح أو منتهي الصلاحية",
    },
    "Invalid API key": {
        "en": "Invalid API key",
        "ar": "مفتاح واجهة برمجة التطبيقات غير صالح",
    },
    "API key not found": {
        "en": "API key not found",
        "ar": "مفتاح واجهة برمجة التطبيقات غير موجود",
    },
    "Invalid key format": {
        "en": "Invalid key format",
        "ar": "صيغة المفتاح غير صالحة",
    },

    # --- Authorization (common across routes) ---
    "Access denied": {
        "en": "Access denied",
        "ar": "تم رفض الوصول",
    },
    "Access denied for this workflow run": {
        "en": "Access denied for this workflow run",
        "ar": "تم رفض الوصول إلى عملية التشغيل هذه",
    },
    "Access denied: Source file does not belong to your organization": {
        "en": "Access denied: Source file does not belong to your organization",
        "ar": "تم رفض الوصول: الملف المصدر لا ينتمي إلى مؤسستك",
    },

    # --- Organization context ---
    "No organization selected": {
        "en": "No organization selected",
        "ar": "لم يتم اختيار أي مؤسسة",
    },
    "No organization selected for the user": {
        "en": "No organization selected for the user",
        "ar": "لم يتم اختيار أي مؤسسة لهذا المستخدم",
    },

    # --- Not found (common across routes) ---
    "Campaign not found": {
        "en": "Campaign not found",
        "ar": "الحملة غير موجودة",
    },
    "Workflow not found": {
        "en": "Workflow not found",
        "ar": "سير العمل غير موجود",
    },
    "Workflow run not found": {
        "en": "Workflow run not found",
        "ar": "عملية تشغيل سير العمل غير موجودة",
    },
    "Telephony configuration not found": {
        "en": "Telephony configuration not found",
        "ar": "إعدادات الاتصال الهاتفي غير موجودة",
    },
    "Phone number not found": {
        "en": "Phone number not found",
        "ar": "رقم الهاتف غير موجود",
    },
    "Tool not found": {
        "en": "Tool not found",
        "ar": "الأداة غير موجودة",
    },
    "Recording not found": {
        "en": "Recording not found",
        "ar": "التسجيل غير موجود",
    },
    "Credential not found": {
        "en": "Credential not found",
        "ar": "بيانات الاعتماد غير موجودة",
    },
    "Document not found": {
        "en": "Document not found",
        "ar": "المستند غير موجود",
    },
    "Text chat session not found": {
        "en": "Text chat session not found",
        "ar": "جلسة المحادثة النصية غير موجودة",
    },
    "Trigger not found in the selected Agent": {
        "en": "Trigger not found in the selected Agent",
        "ar": "لم يتم العثور على المُشغِّل في الوكيل المحدد",
    },
    "Agent trigger not found": {
        "en": "Agent trigger not found",
        "ar": "مُشغِّل الوكيل غير موجود",
    },
    "No active embed token found for this workflow": {
        "en": "No active embed token found for this workflow",
        "ar": "لا يوجد رمز تضمين نشط لسير العمل هذا",
    },
    "No Langfuse credentials found": {
        "en": "No Langfuse credentials found",
        "ar": "لم يتم العثور على بيانات اعتماد Langfuse",
    },

    # --- Invalid input / validation (common) ---
    "Invalid filter format": {
        "en": "Invalid filter format",
        "ar": "صيغة عامل التصفية غير صالحة",
    },
    "Invalid filters format": {
        "en": "Invalid filters format",
        "ar": "صيغة عوامل التصفية غير صالحة",
    },
    "Invalid embed token": {
        "en": "Invalid embed token",
        "ar": "رمز التضمين غير صالح",
    },
    "Invalid date format. Use YYYY-MM-DD": {
        "en": "Invalid date format. Use YYYY-MM-DD",
        "ar": "صيغة التاريخ غير صالحة. استخدم YYYY-MM-DD",
    },
    "Invalid workflow_run_id in key": {
        "en": "Invalid workflow_run_id in key",
        "ar": "معرّف عملية التشغيل غير صالح في المفتاح",
    },
    "Bad workflow_run_id": {
        "en": "Bad workflow_run_id",
        "ar": "معرّف عملية التشغيل غير صالح",
    },
    "Recording ID cannot be empty": {
        "en": "Recording ID cannot be empty",
        "ar": "لا يمكن أن يكون معرّف التسجيل فارغًا",
    },

    # --- Embed tokens ---
    "Embed token is inactive": {
        "en": "Embed token is inactive",
        "ar": "رمز التضمين غير نشط",
    },
    "Embed token has expired": {
        "en": "Embed token has expired",
        "ar": "انتهت صلاحية رمز التضمين",
    },
    "Embed token usage limit exceeded": {
        "en": "Embed token usage limit exceeded",
        "ar": "تم تجاوز حد استخدام رمز التضمين",
    },

    # --- Workflow state ---
    "Workflow is not active": {
        "en": "Workflow is not active",
        "ar": "سير العمل غير نشط",
    },
    "Workflow has no published definition": {
        "en": "Workflow has no published definition",
        "ar": "سير العمل لا يحتوي على تعريف منشور",
    },
    "Workflow has no execution owner": {
        "en": "Workflow has no execution owner",
        "ar": "سير العمل ليس له مالك تنفيذ",
    },
    "Workflow run is not a text chat session": {
        "en": "Workflow run is not a text chat session",
        "ar": "عملية التشغيل ليست جلسة محادثة نصية",
    },
    "No draft to publish": {
        "en": "No draft to publish",
        "ar": "لا توجد مسودة للنشر",
    },
    "Agent trigger is not active": {
        "en": "Agent trigger is not active",
        "ar": "مُشغِّل الوكيل غير نشط",
    },

    # --- Telephony ---
    "Telephony provider not configured for this organization": {
        "en": "Telephony provider not configured for this organization",
        "ar": "لم يتم تكوين مزوّد الاتصال الهاتفي لهذه المؤسسة",
    },
    "Telephony provider not configured for this configuration": {
        "en": "Telephony provider not configured for this configuration",
        "ar": "لم يتم تكوين مزوّد الاتصال الهاتفي لهذا الإعداد",
    },
    "Telephony configuration violates a uniqueness constraint.": {
        "en": "Telephony configuration violates a uniqueness constraint.",
        "ar": "إعدادات الاتصال الهاتفي تنتهك قيد التفرّد.",
    },
    "A phone number with this address already exists in the org.": {
        "en": "A phone number with this address already exists in the org.",
        "ar": "يوجد بالفعل رقم هاتف بهذا العنوان في المؤسسة.",
    },
    "Phone number must be provided in request or set in organization preferences": {
        "en": "Phone number must be provided in request or set in organization preferences",
        "ar": "يجب توفير رقم الهاتف في الطلب أو ضبطه في تفضيلات المؤسسة",
    },
    "Provider cannot be changed; create a new configuration instead.": {
        "en": "Provider cannot be changed; create a new configuration instead.",
        "ar": "لا يمكن تغيير المزوّد؛ أنشئ إعدادًا جديدًا بدلاً من ذلك.",
    },
    "You must configure telephony first by going to APP_URL/configure-telephony": {
        "en": "You must configure telephony first by going to APP_URL/configure-telephony",
        "ar": "يجب تكوين الاتصال الهاتفي أولاً بالانتقال إلى APP_URL/configure-telephony",
    },

    # --- TURN / signaling ---
    "TURN server not configured": {
        "en": "TURN server not configured",
        "ar": "لم يتم تكوين خادم TURN",
    },
    "Failed to generate TURN credentials": {
        "en": "Failed to generate TURN credentials",
        "ar": "فشل في إنشاء بيانات اعتماد TURN",
    },

    # --- Campaigns ---
    "This campaign has already been redialed": {
        "en": "This campaign has already been redialed",
        "ar": "تمت إعادة الاتصال بهذه الحملة بالفعل",
    },
    "No subscribers match the selected redial criteria": {
        "en": "No subscribers match the selected redial criteria",
        "ar": "لا يوجد مشتركون يطابقون معايير إعادة الاتصال المحددة",
    },

    # --- Configuration ---
    "Organization already has a v2 model configuration": {
        "en": "Organization already has a v2 model configuration",
        "ar": "المؤسسة لديها بالفعل إعداد نموذج من الإصدار الثاني",
    },
    "Daily breakdown is only available for organizations with pricing configured": {
        "en": "Daily breakdown is only available for organizations with pricing configured",
        "ar": "التفصيل اليومي متاح فقط للمؤسسات التي تم تكوين التسعير لها",
    },
    "Storage configuration error": {
        "en": "Storage configuration error",
        "ar": "خطأ في إعدادات التخزين",
    },

    # --- Credential validation (api/routes/credentials.py) ---
    "Custom Header credential requires 'header_name' and 'header_value' fields": {
        "en": "Custom Header credential requires 'header_name' and 'header_value' fields",
        "ar": "تتطلب بيانات اعتماد الترويسة المخصصة الحقلين 'header_name' و'header_value'",
    },
    "Bearer Token credential requires 'token' field": {
        "en": "Bearer Token credential requires 'token' field",
        "ar": "تتطلب بيانات اعتماد رمز Bearer الحقل 'token'",
    },
    "Basic Auth credential requires 'username' and 'password' fields": {
        "en": "Basic Auth credential requires 'username' and 'password' fields",
        "ar": "تتطلب بيانات اعتماد المصادقة الأساسية الحقلين 'username' و'password'",
    },
    "API Key credential requires 'header_name' and 'api_key' fields": {
        "en": "API Key credential requires 'header_name' and 'api_key' fields",
        "ar": "تتطلب بيانات اعتماد مفتاح API الحقلين 'header_name' و'api_key'",
    },
    "Either 'provider_user_id' or 'user_id' must be provided.": {
        "en": "Either 'provider_user_id' or 'user_id' must be provided.",
        "ar": "يجب توفير 'provider_user_id' أو 'user_id'.",
    },

    # --- Service keys ---
    "Service key reactivation is not supported. Once a service key is archived, it cannot be reactivated. Please create a new service key instead.": {
        "en": "Service key reactivation is not supported. Once a service key is archived, it cannot be reactivated. Please create a new service key instead.",
        "ar": "إعادة تنشيط مفتاح الخدمة غير مدعومة. بمجرد أرشفة مفتاح الخدمة، لا يمكن إعادة تنشيطه. يُرجى إنشاء مفتاح خدمة جديد بدلاً من ذلك.",
    },
    "Service key not found, already archived, or access denied": {
        "en": "Service key not found, already archived, or access denied",
        "ar": "مفتاح الخدمة غير موجود أو مؤرشف بالفعل أو تم رفض الوصول",
    },

    # --- Failure / processing messages (common) ---
    "Failed to generate presigned upload URL": {
        "en": "Failed to generate presigned upload URL",
        "ar": "فشل في إنشاء رابط الرفع الموقّع مسبقًا",
    },
    "Failed to generate download URL": {
        "en": "Failed to generate download URL",
        "ar": "فشل في إنشاء رابط التنزيل",
    },
    "Failed to generate upload URL": {
        "en": "Failed to generate upload URL",
        "ar": "فشل في إنشاء رابط الرفع",
    },
    "Failed to generate upload URLs": {
        "en": "Failed to generate upload URLs",
        "ar": "فشل في إنشاء روابط الرفع",
    },
    "Failed to generate signed URL": {
        "en": "Failed to generate signed URL",
        "ar": "فشل في إنشاء الرابط الموقّع",
    },
    "Failed to transcribe audio": {
        "en": "Failed to transcribe audio",
        "ar": "فشل في تفريغ الصوت",
    },
    "Failed to search chunks": {
        "en": "Failed to search chunks",
        "ar": "فشل في البحث في المقاطع",
    },
    "Failed to retrieve service keys": {
        "en": "Failed to retrieve service keys",
        "ar": "فشل في استرجاع مفاتيح الخدمة",
    },
    "Failed to reactivate API key": {
        "en": "Failed to reactivate API key",
        "ar": "فشل في إعادة تنشيط مفتاح API",
    },
    "Failed to process document": {
        "en": "Failed to process document",
        "ar": "فشل في معالجة المستند",
    },
    "Failed to list recordings": {
        "en": "Failed to list recordings",
        "ar": "فشل في سرد التسجيلات",
    },
    "Failed to list documents": {
        "en": "Failed to list documents",
        "ar": "فشل في سرد المستندات",
    },
    "Failed to get file metadata": {
        "en": "Failed to get file metadata",
        "ar": "فشل في الحصول على بيانات الملف الوصفية",
    },
    "Failed to get document": {
        "en": "Failed to get document",
        "ar": "فشل في الحصول على المستند",
    },
    "Failed to generate unique recording ID": {
        "en": "Failed to generate unique recording ID",
        "ar": "فشل في إنشاء معرّف تسجيل فريد",
    },
    "Failed to delete recording": {
        "en": "Failed to delete recording",
        "ar": "فشل في حذف التسجيل",
    },
    "Failed to delete document": {
        "en": "Failed to delete document",
        "ar": "فشل في حذف المستند",
    },
    "Failed to deactivate embed token": {
        "en": "Failed to deactivate embed token",
        "ar": "فشل في إلغاء تنشيط رمز التضمين",
    },
    "Failed to create workflow run": {
        "en": "Failed to create workflow run",
        "ar": "فشل في إنشاء عملية تشغيل سير العمل",
    },
    "Failed to create session": {
        "en": "Failed to create session",
        "ar": "فشل في إنشاء الجلسة",
    },
    "Failed to create recordings": {
        "en": "Failed to create recordings",
        "ar": "فشل في إنشاء التسجيلات",
    },
    "Failed to archive API key": {
        "en": "Failed to archive API key",
        "ar": "فشل في أرشفة مفتاح API",
    },
    "Failed to update recording": {
        "en": "Failed to update recording",
        "ar": "فشل في تحديث التسجيل",
    },

    # --- Auth / API keys (additional) ---
    "Unauthorized": {
        "en": "Unauthorized",
        "ar": "غير مُصرّح",
    },
    "Authorization header required": {
        "en": "Authorization header required",
        "ar": "ترويسة التفويض مطلوبة",
    },
    "Invalid authorization token": {
        "en": "Invalid authorization token",
        "ar": "رمز التفويض غير صالح",
    },
    "Missing authentication token": {
        "en": "Missing authentication token",
        "ar": "رمز المصادقة مفقود",
    },
    "Invalid or expired API key": {
        "en": "Invalid or expired API key",
        "ar": "مفتاح واجهة برمجة التطبيقات غير صالح أو منتهي الصلاحية",
    },
    "Missing API key — send X-API-Key or Authorization: Bearer <key>": {
        "en": "Missing API key — send X-API-Key or Authorization: Bearer <key>",
        "ar": "مفتاح واجهة برمجة التطبيقات مفقود — أرسل X-API-Key أو Authorization: Bearer <key>",
    },
    "API key has no associated user": {
        "en": "API key has no associated user",
        "ar": "مفتاح واجهة برمجة التطبيقات غير مرتبط بأي مستخدم",
    },
    "API key owner not found": {
        "en": "API key owner not found",
        "ar": "لم يُعثر على مالك مفتاح واجهة برمجة التطبيقات",
    },
    "Access denied. Superuser privileges required.": {
        "en": "Access denied. Superuser privileges required.",
        "ar": "تم رفض الوصول. مطلوب صلاحيات المشرف الأعلى.",
    },
    "User not found": {
        "en": "User not found",
        "ar": "المستخدم غير موجود",
    },

    # --- Organizations / teams / members ---
    "No active organization for this session.": {
        "en": "No active organization for this session.",
        "ar": "لا توجد مؤسسة نشطة لهذه الجلسة.",
    },
    "Organization not found.": {
        "en": "Organization not found.",
        "ar": "المؤسسة غير موجودة.",
    },
    "No team selected": {
        "en": "No team selected",
        "ar": "لم يتم اختيار أي فريق",
    },
    "Team not found.": {
        "en": "Team not found.",
        "ar": "الفريق غير موجود.",
    },
    "Team name is required.": {
        "en": "Team name is required.",
        "ar": "اسم الفريق مطلوب.",
    },
    "Team name cannot be empty.": {
        "en": "Team name cannot be empty.",
        "ar": "لا يمكن أن يكون اسم الفريق فارغًا.",
    },
    "Team member not found.": {
        "en": "Team member not found.",
        "ar": "عضو الفريق غير موجود.",
    },
    "Member not found.": {
        "en": "Member not found.",
        "ar": "العضو غير موجود.",
    },
    "Invalid role.": {
        "en": "Invalid role.",
        "ar": "الدور غير صالح.",
    },
    "User is not a member of this organization.": {
        "en": "User is not a member of this organization.",
        "ar": "المستخدم ليس عضوًا في هذه المؤسسة.",
    },
    "You are not a member of this organization.": {
        "en": "You are not a member of this organization.",
        "ar": "أنت لست عضوًا في هذه المؤسسة.",
    },
    "You cannot remove yourself from the organization.": {
        "en": "You cannot remove yourself from the organization.",
        "ar": "لا يمكنك إزالة نفسك من المؤسسة.",
    },
    "You must be an organization owner or admin to perform this action.": {
        "en": "You must be an organization owner or admin to perform this action.",
        "ar": "يجب أن تكون مالكًا أو مسؤولًا في المؤسسة لتنفيذ هذا الإجراء.",
    },

    # --- Invitations ---
    "Invitation not found.": {
        "en": "Invitation not found.",
        "ar": "الدعوة غير موجودة.",
    },
    "This invitation has expired.": {
        "en": "This invitation has expired.",
        "ar": "انتهت صلاحية هذه الدعوة.",
    },
    "This invitation is no longer valid.": {
        "en": "This invitation is no longer valid.",
        "ar": "لم تعد هذه الدعوة صالحة.",
    },
    "Invitation is no longer pending and cannot be revoked.": {
        "en": "Invitation is no longer pending and cannot be revoked.",
        "ar": "لم تعد الدعوة قيد الانتظار ولا يمكن إلغاؤها.",
    },

    # --- Webhooks ---
    "Invalid webhook signature": {
        "en": "Invalid webhook signature",
        "ar": "توقيع الـ webhook غير صالح",
    },
    "Webhook body is not valid UTF-8": {
        "en": "Webhook body is not valid UTF-8",
        "ar": "محتوى الـ webhook ليس بترميز UTF-8 صالح",
    },

    # --- Workflow runs ---
    "Workflow run already completed": {
        "en": "Workflow run already completed",
        "ar": "اكتملت عملية تشغيل سير العمل بالفعل",
    },

    # --- Model / TTS configuration ---
    "Azure Realtime requires an endpoint.": {
        "en": "Azure Realtime requires an endpoint.",
        "ar": "يتطلب Azure Realtime نقطة نهاية.",
    },
    "MiniMax TTS requires a group_id. Configure it in your TTS settings.": {
        "en": "MiniMax TTS requires a group_id. Configure it in your TTS settings.",
        "ar": "يتطلب MiniMax TTS معرّف مجموعة (group_id). اضبطه في إعدادات تحويل النص إلى كلام.",
    },
}


def resolve_locale(headers: Mapping[str, str]) -> str:
    """Resolve the request locale from headers.

    Resolution order:
    1. ``x-locale`` header — honored only when it is exactly ``ar`` or ``en``.
    2. ``accept-language`` header — ``ar`` when it starts with ``ar``.
    3. Default to ``en``.

    ``headers`` may be any case-insensitive mapping (Starlette ``Headers``) or a
    plain dict; lookups are done case-insensitively as a safety net.
    """

    def _get(name: str) -> str | None:
        # Starlette Headers are case-insensitive; plain dicts may not be.
        try:
            value = headers.get(name)
        except Exception:
            value = None
        if value is None:
            for key in headers:
                if key.lower() == name:
                    value = headers[key]
                    break
        return value

    x_locale = _get("x-locale")
    if x_locale:
        normalized = x_locale.strip().lower()
        if normalized in ("ar", "en"):
            return normalized

    accept_language = _get("accept-language")
    if accept_language and accept_language.strip().lower().startswith("ar"):
        return "ar"

    return DEFAULT_LOCALE


def translate(message: str, locale: str | None = None) -> str:
    """Translate an English ``message`` into ``locale``.

    Falls back to the original ``message`` when the locale is English, the
    message is not in the catalog, or no translation exists for that locale.
    """
    if locale is None:
        locale = current_locale.get()

    if locale == DEFAULT_LOCALE:
        return message

    entry = TRANSLATIONS.get(message)
    if not entry:
        return message

    return entry.get(locale, message)
