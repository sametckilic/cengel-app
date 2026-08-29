# Bağımsız Backend ve Bulmaca Yayınlama Planı

## Amaç ve kararlar

Çengel'in oyuncu uygulaması bulmaca üretmeyecek. Expo uygulaması yalnızca içerik tüketimi, oynanış ve yerel önbellekten sorumlu olacak; üretim ve yayınlama istek-cevap döngüsünün dışında çalışan güvenilir bir backend süreci olacak.

Kararlaştırılan temel seçimler:

- Backend: TypeScript, NestJS ve Fastify kullanan bağımsız bir modüler monolit
- Veritabanı: Railway üzerinde PostgreSQL
- Dağıtım: Docker ile Railway; API ve worker ayrı servisler
- Kimlik: zorunlu hesap olmadan yerel misafir modu; isteğe bağlı Supabase e-posta/şifre hesabı
- Abonelik: RevenueCat; backend webhook olaylarından entitlement üretir
- Doğrulama: çevrimdışı rahat bulmacalar ve sunucuda doğrulanan rekabetçi bulmacalar olmak üzere iki katman
- İlk milestone: bağımsız içerik API'si, PostgreSQL, generator worker ve mobil katalog geçişi

Başlangıçta mikroservis kullanılmayacak. API ve worker bağımsız çalıştırılabilir uygulamalar olacak ancak aynı domain paketlerini ve aynı PostgreSQL veritabanını paylaşacak.

## Hedef mimari

```text
Expo uygulaması
      │
      ▼
Bağımsız API ───────────── PostgreSQL
      │                         │
      ├─ içerik                 ├─ puzzle tanımları
      ├─ profil                 ├─ yayın takvimi
      ├─ ilerleme               ├─ kullanıcı ilerlemesi
      ├─ başarımlar             └─ entitlement kayıtları
      └─ abonelik
                                ▲
Railway cron ──► Generator ──► Kalite kapısı ──► Yayınlama
                                ▲
RevenueCat ───────────────► Webhook
Supabase Auth ─────────────► JWT doğrulama
```

Generator hiçbir public API isteğinin içinde çalışmayacak. Zamanlanmış worker gelecekteki bulmacaları önceden üretecek, deterministik kalite kontrollerinden geçirecek ve yalnızca başarılı sonuçları atomik olarak yayınlayacak. AI ileride yalnızca generator'a aday içerik sağlayabilir; çıktısı aynı kalite kapısını geçmeden yayınlanamaz.

## Monorepo sınırları

Repository npm workspaces yapısına geçirilecek:

```text
apps/
  mobile/       Expo SDK 54 uygulaması
  api/          NestJS + Fastify HTTP servisi
  worker/       Kısa ömürlü üretim/yayınlama işleri
packages/
  contracts/    API şemaları, DTO'lar ve runtime doğrulama
  puzzle-core/  Puzzle tipleri, seçim, doğrulama ve progress kuralları
  generator/    Dataset, topology, fill, kalite ve yayınlama mantığı
datasets/       Projeye ait ham içerik
```

Mevcut Expo uygulaması ilk yapısal increment'te davranış değiştirmeden `apps/mobile` altına taşınacak. npm kullanılmaya devam edilecek; Expo SDK 54 monorepo çözümlemesi ve `autolinkingModuleResolution` etkinleştirilecek. Ortak paketler platform API'lerine bağımlı olmayacak.

## Veri modeli

İçerik alanı ilk milestone'ta şu kayıtları içerir:

- `clue_catalog_versions`: katalog sürümü, checksum, hak temeli ve import zamanı
- `clues`: sabit clue kimliği, cevap, kısa soru, kategori, zorluk ve normalize alanları
- `puzzles`: immutable puzzle kimliği/sürümü, metadata, validation mode, definition JSON ve checksum
- `puzzle_publications`: puzzle, yayın günü, zaman dilimi, durum ve gerekli entitlement
- `generation_runs`: tarih, profil, seed/revision, katalog sürümü, durum, kalite raporu ve hata

Yayınlanmış bir puzzle yerinde değiştirilemez. Bir düzeltme gerekiyorsa yeni sürüm üretilir. Günlük yayın tarihi `Europe/Istanbul` üzerinden hesaplanır ve aynı gün/tür için ikinci aktif yayın veritabanı kısıtıyla engellenir. Mevcut puzzle ID'leri korunarak idempotent import yapılır; böylece cihazdaki ilerleme kayıtları bozulmaz.

Sonraki alanlar aynı backend içinde ayrı modüller olarak eklenir:

- `profiles` ve `devices`
- `progress_events` ve `progress_snapshots`
- `achievement_definitions` ve `user_achievements`
- `subscription_events` ve `entitlements`

Uygulama verileri Railway PostgreSQL'de tutulur. Supabase yalnızca Auth sağlayıcısıdır; mobil istemci domain tablolarına doğrudan erişmez.

## Public ve internal arayüzler

İlk içerik API'si:

- `GET /health`
- `GET /v1/puzzles` — cursor tabanlı özet listesi; kategori ve zorluk filtresi
- `GET /v1/puzzles/daily?date=YYYY-MM-DD` — varsayılan olarak İstanbul'daki bugün
- `GET /v1/puzzles/:id` — tek puzzle tanımı

Yanıtlar `apiVersion`, kaynak sürümü, ETag ve cache başlıkları taşır. Hatalar `code`, `message` ve `requestId` içeren ortak bir zarf kullanır. Gelecek tarihli, taslak veya kaliteyi geçmemiş içerik public endpoint'lerden dönmez.

Sonraki kullanıcı API'leri:

- `GET /v1/me` ve `PATCH /v1/me`
- `POST /v1/progress/sync`
- `GET /v1/me/achievements`
- `GET /v1/me/entitlements`
- `POST /v1/webhooks/revenuecat`

Progress sync, cihazdaki SQLite snapshot'ına ek olarak idempotent bir outbox kullanır. Her olay `eventId`, `deviceId`, `clientUpdatedAt` ve puzzle kimliği taşır. Sunucu aynı kullanıcı için olayları transaction ve advisory lock altında işler; çakışmalarda önce `clientUpdatedAt`, eşitlikte `eventId` sırası belirleyicidir. Yanıt, onaylanan event ID'lerini ve kullanıcının canonical snapshot/tombstone kayıtlarını döndürür.

## Cevap güveni ve premium içerik

Puzzle tanımı `validationMode` taşır:

- `offline-casual`: Cevap cihazda bulunabilir; kullanıcı tamamen çevrimdışı oynar. Bu sonuçlardan doğan başarımlar `casual` olarak işaretlenir.
- `server-verified`: Public tanım cevap içermez; giriş doğrulaması backend'de yapılır. Rekabetçi skor ve başarımlar yalnızca bu modda `verified` olur.

Premium puzzle tanımları uygulama bundle'ına gömülmez. API, aktif entitlement olmadan premium liste veya detay döndürmez. İstemciden gelen `isPremium` benzeri değerlere güvenilmez.

Yayın erişim politikası `@cengel/contracts/content-publication-policy` içinde tek kaynaktan yönetilir:

- Günün bulmacası ücretsizdir ve `required_entitlement` değeri `null` olur.
- Arşiv bulmacaları `premium_access` gerektirir.
- Tematik pakette birinci bulmaca ücretsizdir; ikinci ve sonraki bulmacalar `premium_access` gerektirir. Paket sıra numarası kullanıcıya gösterilen numarayla aynı olacak şekilde 1 tabanlıdır.
- API entitlement olmadan yeni bir premium tanım teslim etmez. Daha önce indirilmiş bir bulmaca yalnızca aynı yerel profil kapsamında çevrimdışı oynanmaya devam edebilir; bu kural yeni premium içerik indirme hakkı vermez.

Publisher, publication satırını oluştururken `required_entitlement` değerini bu ortak politikadan çözer. Archive ve pack publisher devreye alınırken mevcut katalog publication kayıtları da aynı kurala göre taşınacaktır.

Hesapla giriş yapan kullanıcıda Supabase UUID'si RevenueCat `app_user_id` olarak kullanılır. Misafir satın alma desteği abonelik aşamasında kalıcı kurulum kimliği ve hesapla birleştirme kurallarıyla ayrıca tasarlanacaktır. RevenueCat webhook'ları event ID ile idempotent işlenir; renewal, cancellation, expiration ve transfer olayları backend entitlement durumunu günceller.

## Uygulama aşamaları

### 0. Dokümantasyon

- Bu dosyayı kanonik karar kaydı olarak ekle ve README'den bağla.
- Sonraki her increment sonunda zorunlu kontrolleri çalıştır, tek amaçlı commit oluştur, `origin/main` dalına pushla ve inceleme için dur.

### 1. Davranış değiştirmeyen monorepo dönüşümü

- Expo uygulamasını `apps/mobile` altına taşı ve root npm workspaces/script yönlendirmelerini kur.
- Ortak contracts, puzzle-core ve generator paketlerinin sınırlarını oluştur; ilk adımda yalnızca mevcut kodu taşı.
- Mevcut UI, route'lar, yerel kayıtlar, generator çıktıları ve GitHub publisher aynı davranışı sürdürsün.

### 2. Bağımsız içerik API'si ve PostgreSQL

- NestJS/Fastify API, Drizzle migration'ları, Docker imajı, config doğrulaması ve health/readiness endpoint'lerini ekle.
- Katalog ve mevcut yayınları idempotent seed/import komutuyla PostgreSQL'e aktar.
- `/v1/puzzles` endpoint'lerini DB üzerinden sun; contract ve ETag davranışını mevcut istemci beklentileriyle eşleştir.
- Railway staging ortamını kur, migration'ları deployment öncesi tek seferlik job olarak çalıştır.

### 3. Generator worker ve yayınlama geçişi

- Mevcut deterministik generator'ı ortak paketten kullanan, tamamlanınca kapanan Railway cron uygulamasına bağla.
- Yedi günlük tampon, retry profilleri, advisory lock, kalite raporu, immutable publish ve transaction rollback uygula.
- Worker'ı önce shadow/dry-run çalıştır; mevcut JSON yayınlarıyla checksum karşılaştır.
- Eşleşme sağlandıktan sonra Railway'i kaynak sistem yap, GitHub workflow'unu yalnızca doğrulama için bırak.

### 4. Mobil katalog cutover

- Expo istemcisini bağımsız API origin'ine geçir; SQLite/localStorage cache ve bundled fallback'i koru.
- Mevcut Expo API route'larını bir uygulama sürümü boyunca proxy/fallback olarak tut.
- Android, iOS ve web doğrulandıktan sonra proxy'yi kaldır; web UI artık backend ile aynı deployment'a bağımlı olmasın.

### 5. Kimlik ve progress sync

Durum: zorunlu kimlik doğrulama kaldırıldı; uygulama yerel misafir olarak açılır. İsteğe bağlı e-posta/şifre kayıt, giriş ve yerel çıkış akışı; native güvenli session saklama; JWT/JWKS doğrulaması; profile/device provisioning; SQLite/localStorage outbox; batch sync; idempotency ve deterministik conflict çözümü tamamlandı. Misafir ilerlemesi ilk girişte yeni hesap/cihaz kimliğine taşınarak senkronizasyon kuyruğuna alınır. Staging'de sync endpoint'i upsert, duplicate event ve tombstone akışlarıyla doğrulandı. Doğrudan kayıt kabul testi için Supabase **Confirm email** ayarı kapatılmalıdır.

- Uygulamayı zorunlu hesap olmadan yerel misafir modunda aç; isteğe bağlı e-posta/şifre session'ını güvenli yerel storage'da sürdür.
- API'de Supabase JWT/JWKS doğrulaması ve profile/device provisioning ekle.
- SQLite outbox, batch sync, duplicate event ve iki cihaz conflict çözümünü uygula.
- İlk girişte mevcut misafir ilerlemesini hesap için yeni cihaz kimliğiyle yeniden kuyruğa al; çıkışta yerel ilerlemeyi koru.

### 6. Abonelik ve başarımlar

Durum: ortak başarı tanımları ile ilk tamamlama, ipucusuz tamamlama, 3 günlük seri ve 7 günlük seri değerlendirme kuralları eklendi. Günlük seri, senkronizasyon zamanından bağımsız olarak tamamlanan `gunun-YYYY-MM-DD` yayın tarihlerinden hesaplanır; sonuçlar `casual` veya `verified` güven düzeyi taşır. PostgreSQL kalıcılığı, progress sync sırasında idempotent değerlendirme, `GET /v1/me/achievements` endpoint'i ve Profil sunumu staging'e dağıtıldı. Gerçek hesapla uçtan uca mobil UAT bekleniyor.

- RevenueCat SDK satın alma/restore akışını ve doğrulanmış webhook endpoint'ini ekle.
- İlk entitlement `premium_access`; premium archive/packs yalnızca API üzerinden teslim edilir.
- İlk başarımlar: ilk tamamlama, 3 günlük seri, 7 günlük seri ve ipucusuz tamamlama.
- Başarımları client beyanından değil, backend progress/validation olaylarından üret.

## Operasyon ve rollout

- Railway'de staging ve production için ayrı API, worker, PostgreSQL ve secret setleri kullanılır.
- API `PORT` üzerinde `0.0.0.0` dinler; CORS yalnızca bilinen web origin'lerine açıktır.
- Secrets yalnızca Railway/Supabase/RevenueCat ortamlarında tutulur; mobil uygulamada sadece public API origin ve Supabase publishable key bulunur.
- Structured log'larda `requestId`, `userId`, `puzzleId` ve `generationRunId` kullanılır; hassas token ve cevaplar loglanmaz.
- PostgreSQL otomatik backup'ları etkinleştirilir ve production öncesi bir restore provası yapılır.
- Cutover sırasında istemci fallback'i ve eski Expo proxy geri dönüş yolu olarak korunur; yeni publisher başarısız olursa daha önce hazırlanmış yedi günlük tampon sunulmaya devam eder.

## Test ve kabul kriterleri

Her increment için:

- `npm run lint`
- `npx tsc --noEmit`
- Generator veya katalog değiştiyse `npm run dataset:check`, `npm run test:generator`, `npm run puzzles:check`
- İlgili engine/progress testleri

Ek backend doğrulamaları:

- API contract/E2E: liste, günlük, detay, filtre, ETag/304, 404 ve gelecek içeriğin gizlenmesi
- DB: tekrar çalıştırılabilir migration/import, immutable yayın, unique tarih ve rollback
- Worker: deterministik sonuç, idempotency, retry, eşzamanlı lock ve başarısızlıkta tamponun korunması
- Auth/progress: misafir açılış, e-posta/şifre kayıt-giriş-çıkış, ilk girişte ilerleme aktarımı, offline replay, duplicate event ve çoklu cihaz conflict
- RevenueCat: webhook doğrulama, duplicate/reordered event, renewal, cancellation, expiration ve transfer
- Mobil: Android/iOS/web export, uzak katalog, cache ve tamamen çevrimdışı fallback

İlk milestone şu koşullarda tamamlanır:

- Railway'de bağımsız API, worker ve PostgreSQL çalışır.
- En az yedi günlük kalite onaylı yayın tamponu vardır.
- Expo istemcisi uzak katalogdan çalışır ve API kesildiğinde mevcut yerel fallback'e döner.
- Oyuncu UI'ında generator veya yönetim kontrolü bulunmaz.
- Mevcut seçme, çözme, kapatıp devam etme ve arşiv ilerlemesi davranışları değişmez.

## Teknik referanslar

- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
- [Expo monorepo rehberi](https://docs.expo.dev/guides/monorepos/)
- [NestJS Fastify adapter](https://docs.nestjs.com/techniques/performance)
- [Supabase parola tabanlı kimlik doğrulama](https://supabase.com/docs/guides/auth/passwords)
- [RevenueCat webhook olayları](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
- [Railway monorepo deployment](https://docs.railway.com/deployments/monorepo)
- [Railway cron jobs](https://docs.railway.com/cron-jobs)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
