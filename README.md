# Çengel

Expo SDK 54 ile geliştirilen, yerel ilerleme kaydı ve sunucudan yayınlanan sabit günlük bulmacalar kullanan çengel bulmaca uygulaması.

Güncel kalan işler ve uygulama sırası için [ROADMAP.md](ROADMAP.md), bağımsız API, generator worker, kullanıcı verisi ve abonelik mimarisinin ayrıntıları için [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) belgesine bakın.

## Geliştirme

```bash
npm install
npm start
```

Komutlar repository kökünden çalıştırılır; Expo uygulaması npm workspace olarak `apps/mobile` altında bulunur.

Temel kontroller:

```bash
npm run lint
npx tsc --noEmit
npm run dataset:check
npm run test:generator
npm run puzzles:check
npm run test:engine
npm run test:progress
npm run test:achievements
npm run test:achievement-api
npm run test:sync
npm run test:auth
npm run test:catalog
```

## İçerik üretimi

Ham JSONL yalnızca build araçları tarafından okunur; Expo runtime içine alınmaz.

```bash
npm run dataset:build
npm run puzzles:build
```

Release katalog hazırlığı tek komutla ham dataseti doğrular, katalog artefaktını
yeniden üretir ve generator ile bulmaca kalite kapılarını çalıştırır:

```bash
npm run content:release:prepare
```

Bu kapı ayrıca V2 recipe matrisindeki 5 boyut × 4 zorluk kombinasyonunun
tamamını gerçek katalogdan üretir; her profil kendi hücresinde kalite ve `%50`
üzeri kategori ağırlığı koşullarını geçmeden release hazırlanmış sayılmaz.
Tek başına çalıştırmak için `npm run newspaper:matrix:check` kullanılabilir.

`main` dalına yeni dataset geldiğinde Railway API image'ı kataloğu kaynak
JSONL'den yeniden üretir. Başarılı image build'inden sonra pre-deploy adımı önce
veritabanı migration'larını, ardından idempotent katalog importunu çalıştırır.
Import başarısız olursa yeni deployment trafiğe açılmaz; generator worker bir
sonraki çalışmasında PostgreSQL'deki en yeni başarılı katalog sürümünü kullanır.

Repository artık eski fixed-topology/freeform tarifleri veya önceden üretilmiş
günlük JSON dosyalarını yayın kaynağı olarak tutmaz. Mobil bundle yalnızca
çevrimdışı açılış için kalite kapısını geçmiş tek bir V2 fallback kullanır;
asıl katalog PostgreSQL'e yazan Railway worker tarafından oluşturulur.

Worker `newspaper-v2` ile yeni tarihler için 7×7, 8×8, 9×10, 10×10 ve
10×12 boyutlarını döndürür. Her istek boyut, zorluk, kategori ağırlığı,
hedef kelime sayısı ve deterministik seed taşır. `newspaper-v1` kod yolu
yalnızca açıkça seçilen acil geri dönüş seçeneği olarak korunur.

Günlük üretimin kaynak sistemi Railway üzerindeki `generator-worker` servisidir. Worker her gün `21:10 UTC` (`00:10 Europe/Istanbul`) çalışır, PostgreSQL'deki güncel ipucu kataloğundan yedi günlük tampon üretir ve kalite kapısını geçen bulmacaları atomik olarak yayınlar. Aynı tarih ve revizyonla tekrar çalıştırılması güvenlidir; mevcut yayınlar değiştirilmez.

[.github/workflows/publish-daily-puzzles.yml](.github/workflows/publish-daily-puzzles.yml) artık yalnızca pull request ve `main` push'larında lint, tip, dataset, generator, puzzle, engine, progress ve Expo server build doğrulamalarını çalıştırır; içerik üretmez veya repository'ye commit atmaz.

## API ve çevrimdışı çalışma

Salt-okunur endpointler:

- `GET /api/puzzles`
- `GET /api/puzzles/:id`

API ETag, `304 Not Modified`, `404` ve cache başlıklarını destekler. Web aynı origin üzerindeki API’yi kullanır. Android ve iOS için üretim origin’i tanımlanmalıdır:

```bash
EXPO_PUBLIC_PUZZLE_API_URL=https://your-cengel-api.example.com
```

Yerel mobil ortam değerleri `apps/mobile/.env.local` içinde tutulur; örnek dosya `apps/mobile/.env.example` konumundadır.

Native katalog önbelleği Expo SQLite’ta, web önbelleği `localStorage` içinde tutulur. Ağ yoksa önbellek; önbellek de yoksa uygulamayla gelen manifest kullanılır.

## Kimlik ve ilerleme senkronizasyonu

Uygulama ilk açılışta hesap istemez; bütün yerel bulmaca akışı misafir olarak kullanılabilir. Profil sekmesinden isteğe bağlı e-posta ve şifre hesabı oluşturulabilir veya mevcut hesaba giriş yapılabilir. Native session Expo SecureStore'da, web session `localStorage` içinde saklanır. Yerel puzzle ilerlemesi hesapla giriş yapıldığında bağımsız API'ye idempotent batch olarak gönderilir; çıkış yapmak cihazdaki yerel ilerlemeyi silmez.

Mobil istemci yalnızca public değerleri kullanır:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Doğrulama bağlantısı olmadan doğrudan kayıt için Supabase projesinde **Authentication → Sign In / Providers → Email** altındaki **Confirm email** kapatılmalıdır. Bu ayar kapalıyken adres sahipliği doğrulanmaz; geçici ürün kararı olarak kabul edilmiştir. Uygulama anonim Supabase oturumu açmadığı için **Anonymous Sign-Ins** ve **Allow manual linking** gerekli değildir. API tarafında aynı proje URL'si `SUPABASE_URL` olarak tanımlanır; yalnızca giriş yapmış kullanıcıların erişim tokenları Supabase JWKS üzerinden doğrulanır. Service-role veya JWT secret mobil uygulamaya eklenmez.

Giriş yapan kullanıcının ilerlemesi senkronize edilirken ilk tamamlama, ipucusuz tamamlama ve 3/7 günlük seri başarımları sunucuda idempotent olarak değerlendirilir. Profil sekmesi kazanılmış ve kilitli durumları `GET /v1/me/achievements` üzerinden gösterir; misafir kullanım bu endpoint'e bağlı değildir.

RevenueCat abonelik olayları `POST /v1/webhooks/revenuecat` endpoint'inde işlenir. Dashboard webhook ayarındaki Authorization değeri API'deki `REVENUECAT_WEBHOOK_AUTHORIZATION` ile birebir aynı olmalıdır. `REVENUECAT_ALLOWED_ENVIRONMENTS` staging için `SANDBOX`, production için `PRODUCTION` olmalıdır; böylece test olayları gerçek entitlement durumunu ezemez. Olay kimlikleri idempotent saklanır; daha eski veya aynı zamandaki daha düşük kimlikli olaylar daha yeni entitlement durumunu ezemez. Transfer olayları geçerli Supabase UUID'leri arasında aktif entitlement'ları taşır. Bu sunucu secret'ı mobil uygulamaya eklenmez.

Giriş yapan kullanıcı güncel erişimlerini `GET /v1/me/entitlements` üzerinden alır. `required_entitlement` taşıyan premium yayınlar anonim katalogdan gizlenir; geçerli bearer token ile yapılan istekte yalnızca aktif ve süresi dolmamış entitlement eşleşirse liste, günlük ve detay endpoint'lerinden döner. Kimlikli içerik yanıtları paylaşılan cache'e açılmaz.

Mobil RevenueCat entegrasyonu geliştirme build'lerinde `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` kullanır ve yalnızca giriş yapmış kullanıcının Supabase UUID'sini RevenueCat App User ID olarak bağlar. Release build'lerinde Test Store anahtarı kullanılmaz; iOS ve Android için ayrı public SDK anahtarları gerekir. Native satın alma testi Expo Go yerine `expo-dev-client` içeren development build ile yapılır.

Android emulator UAT build'i `com.sametckilic.cengel` package kimliğini ve `eas.json` içindeki `development` profilini kullanır. Expo projesi bağlandıktan sonra build `npx eas-cli build --platform android --profile development` ile üretilir; çıktı emülatöre kurulabilen APK formatındadır.

## Server build

Expo Router API Routes nedeniyle web çıktısı `server` modundadır; yalnızca statik hosting yeterli değildir.

```bash
npm run server:build
npm run server:serve
```

Üretim çıktısı `apps/mobile/dist/client` ve `apps/mobile/dist/server` altında oluşur. Bu paket EAS Hosting veya Expo server adapter destekleyen başka bir sunucuya dağıtılabilir. Gerçek deployment için seçilen hosting projesinin kimliği/hesabı ve gerekiyorsa `EXPO_TOKEN` yapılandırılmalıdır.
