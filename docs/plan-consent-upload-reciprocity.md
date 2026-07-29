# Plan — Dikey Dilim: Consent → Gerçek Upload → Reciprocity Kilidi

> **Durum (2026-07-29): UYGULANDI.** `supabase/migrations/0001_init_schema.sql` +
> `0002_reciprocity_and_storage.sql` oluşturuldu ve `supabase db push` ile uygulandı;
> `supabase/config.toml` → `enable_anonymous_sign_ins = true`. Aşağıdaki "migrations klasörü boş"
> tespiti artık tarihsel — plan referans olarak korunuyor.
>
> Kaynak spec: `docs/10-spec.md` (B-2, B-3, B-4) · Mimari: `docs/20-architecture.md`
> Kapsam: Faz 0. "Bitti" = aşağıdaki 5 kabul kriteri.

## Kabul kriterleri

1. Consent olmadan upload endpoint'i **server-side** reddeder (yalnızca UI değil).
2. Dosya tipi server'da **MIME-sniff** ile doğrulanır.
3. **50MB** aşımı reddedilir.
4. Galeri erişimi en az 1 tamamlanmış upload olmadan **RLS seviyesinde** engellenir.
5. Her yeni/değişen RLS politikası ve `service_role` kullanımı ayrıca belirtilir.

## Durum tespiti (mevcut kod)

Bellek "MVP feature-complete" diyor ama kritik boşluk: **`supabase/migrations/` klasörü boş.**
Tablolar, RLS politikaları ve storage bucket'ı yalnızca `docs/20-architecture.md` içinde SQL
olarak duruyor — commit edilmiş migration yok. API route'ları var olmayan bir şemaya karşı yazılı.

| #   | Kriter                     | Şu an                                                                                                                                         | Boşluk                                |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | Consent server-side reddi  | Consent **sadece UI'da** (`GuestFlow` checkbox). `/api/sessions` ve `presign` consent'i doğrulamıyor; presign `consent_at`'i koşulsuz yazıyor | ❌ UI-only — kriterin yasakladığı şey |
| 2   | MIME server sniff          | `lib/storage/mime.ts` magic-byte kontrolü `confirm` route'unda çağrılıyor                                                                     | ✅ Var (doğrulanacak)                 |
| 3   | 50MB reddi                 | Server-side boyut sınırı yok; bucket yok; UI'da yanlış "Max. 100 MB"                                                                          | ❌ Yok                                |
| 4   | Reciprocity RLS'te         | `gallery/route.ts:47` "enforced at API level". Arch'taki `public_gallery_select` reciprocity içermiyor                                        | ❌ API-level, RLS değil               |
| 5   | RLS/service_role envanteri | —                                                                                                                                             | Plan + raporda listelenir             |

## Plan

### 1. DB temeli (migration) — `supabase/migrations/`

- **`0001_init_schema.sql`**: `tenants`, `events`, `submissions` tabloları + indexler +
  `current_tenant_id()` (security definer) + arch'taki tüm temel RLS politikaları.
  _(Bugüne kadar sadece dokümanda; ilk kez migration'a giriyor.)_
- **`0002_reciprocity_and_storage.sql`**:
  - **YENİ fonksiyon** `has_completed_upload(p_event_id uuid) returns boolean` — `security definer`.
    RLS özyinelemesini önlemek için standart Supabase kalıbı: `auth.uid()`'in o event'e
    `uploaded_at not null, deleted_at null` bir submission'ı var mı diye bakar.
  - **DEĞİŞEN politika** `public_gallery_select` (submissions SELECT): arch'ta
    `using (moderation_flag=false and deleted_at is null)` idi → yeni koşul
    `... and uploaded_at is not null and public.has_completed_upload(event_id)`.
    **Reciprocity kilidi artık RLS'te.** (Kriter 4)
  - **Storage**: `ugc-media` bucket'ı (private, `file_size_limit = 52428800` = 50MiB,
    `allowed_mime_types`). 50MB aşımını PUT sırasında Storage reddeder — client bypass edemez
    (Kriter 3). Ayrıca `storage.objects` üzerinde tenant-prefix RLS politikaları
    (`tenant_read_own_media`, `tenant_delete_own_media`).

### 2. Consent server-side zorlaması (Kriter 1)

- `lib/validation/schemas.ts` → `presignSchema`'ya `consent: z.literal(true)`. Consent yoksa/false
  → zod reddeder → 400, submission satırı **oluşmaz**, upload URL **verilmez**. `consent_at NOT NULL`
  DB kısıtı da backstop. Enforcement noktası presign, çünkü `consent_at` orada kalıcılaşıyor.
- `GuestFlow.tsx` → presign gövdesine `consent: true` (landing'i geçmenin tek yolu checkbox zaten).

### 3. 50MB (Kriter 3)

- Otoriter sınır = bucket `file_size_limit`. Ek olarak `presignSchema`'ya
  `fileSizeBytes: z.number().int().positive().max(52_428_800)` → erken/temiz hata (UX).
  `GuestFlow`: "100 MB" → "50 MB" düzelt + client-side ön kontrol.

### 4. MIME (Kriter 2)

- Mevcut `confirm` akışı korunuyor; uçtan uca doğruluğu + testi teyit edilecek. Yeni kod yok.

### 5. Test + tutarlılık

- `tests/schemas.test.ts`: consent eksik/false → red, `fileSizeBytes` > 50MB → red, geçerli → kabul.
  (DoD "≥1 test")
- Galeri API'sindeki mevcut 403 kontrolü UX için kalır; gerçek sınır RLS. Route RLS-aktif server
  client kullanıyor.

## Kriter 5 — açık envanter

**Yeni/değişen RLS ve privileged objeler:**

- `current_tenant_id()` — security definer (arch'tan, ilk kez migration'da)
- `has_completed_upload()` — **YENİ** security definer
- `public_gallery_select` — **DEĞİŞEN** (reciprocity koşulu eklendi)
- `storage.objects` tenant-prefix politikaları — **YENİ**
- Temel tenant/events/submissions politikaları — ilk kez migration'a giriyor

**service_role (admin client) kullanımı** — hepsi mevcut, kritik yolda, her biri öncesinde
app-level yetki kontrolü var; bu dilimde YENİ service_role kullanımı eklenmiyor:

- `presign`: `createSignedUploadUrl`, `media_url` update, hata temizliği delete
- `confirm`: submission fetch (ownership), `createSignedUrl` (MIME okuma), invalid'de `remove`+delete,
  `uploaded_at` update
- `gallery`: onaylı öğeler için `createSignedUrls`

## Dokunulacak dosyalar

- **Yeni:** `supabase/migrations/0001_init_schema.sql`, `supabase/migrations/0002_reciprocity_and_storage.sql`
- **Düzenlenecek:** `lib/validation/schemas.ts`, `app/e/[eventId]/GuestFlow.tsx`, `tests/schemas.test.ts`,
  `app/api/events/[eventId]/gallery/route.ts` (yalnızca yorum/RLS teyidi)
- **Dokunulmayacak:** presign/confirm route mantığı (schema zaten reddedecek), Faz-0 "NICHT"-listesi,
  `types/database.ts` elle düzenlenmeyecek (`gen types` migration sonrası dokümante adım)

## Notlar

- `types/database.ts` zaten bu şemayla uyumlu; migration sonrası `npx supabase gen types` ile yenilenmesi
  dokümante adım (Docker/local stack gerekir).
- RLS'in gerçek davranışı vitest'te DB olmadan test edilemez; Faz 0 DoD için schema testleri yeterli.
  pgTAP kapsam dışı.
- Consent zorlaması yalnızca `presign`'de öneriliyor (consent_at'in kalıcılaştığı yer); `/api/sessions`'a
  ek koymak gereksiz tekrar.
