# Çengel

Expo SDK 54 ile geliştirilen, yerel ilerleme kaydı ve sunucudan yayınlanan sabit günlük bulmacalar kullanan çengel bulmaca uygulaması.

Bağımsız API, generator worker, kullanıcı verisi ve abonelik mimarisinin aşamalı uygulama planı için [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) belgesine bakın.

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

Tek bir günlük yayın üretmek:

```bash
npm run daily:generate -- --date 2026-08-23 --profile easy-mixed-wide --revision v1 --output apps/mobile/data/generated/daily/gunun-2026-08-23.json
```

Yarından başlayarak yedi günlük kalite onaylı tamponu tamamlamak:

```bash
npm run daily:publish -- --start tomorrow --days 7 --revision schedule-v1 --publish
```

Komut mevcut tarih dosyalarını değiştirmez. Eksik günleri deterministik olarak üretir, kalite kapısından geçirir ve ana manifesti İstanbul tarihine göre yeniler. Gelecek tarihli dosyalar önceden hazırlanır ancak tarihleri gelmeden manifest veya API üzerinden sunulmaz.

Profil rotasyonu:

- `beginner-geography-compact`: 7×7, başlangıç, coğrafya ağırlıklı
- `easy-mixed-wide`: 9×10, kolay, Türkçe ve genel kültür ağırlıklı
- `medium-literature-balanced`: 8×8, orta, edebiyat ağırlıklı

Worker `newspaper-v2` ile yeni tarihler için 7×7, 8×8, 9×10, 10×10 ve
10×12 boyutlarını döndürür. Her istek boyut, zorluk, kategori ağırlığı,
hedef kelime sayısı ve deterministik seed taşır. `newspaper-v1` acil geri
dönüş seçeneği olarak korunur; yayımlanmış tarihler iki sürümde de
değiştirilmez.

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

RevenueCat abonelik olayları `POST /v1/webhooks/revenuecat` endpoint'inde işlenir. Dashboard webhook ayarındaki Authorization değeri API'deki `REVENUECAT_WEBHOOK_AUTHORIZATION` ile birebir aynı olmalıdır. Olay kimlikleri idempotent saklanır; daha eski sıradan gelen olaylar daha yeni entitlement durumunu ezemez. Bu sunucu secret'ı mobil uygulamaya eklenmez.

## Server build

Expo Router API Routes nedeniyle web çıktısı `server` modundadır; yalnızca statik hosting yeterli değildir.

```bash
npm run server:build
npm run server:serve
```

Üretim çıktısı `apps/mobile/dist/client` ve `apps/mobile/dist/server` altında oluşur. Bu paket EAS Hosting veya Expo server adapter destekleyen başka bir sunucuya dağıtılabilir. Gerçek deployment için seçilen hosting projesinin kimliği/hesabı ve gerekiyorsa `EXPO_TOKEN` yapılandırılmalıdır.
