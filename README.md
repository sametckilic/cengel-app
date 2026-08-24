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
npm run test:sync
npm run test:auth
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

Uygulama ilk açılışta Supabase Auth üzerinden anonim bir kullanıcı oluşturur. Native session Expo SecureStore'da, web session `localStorage` içinde saklanır. Yerel puzzle ilerlemesi çevrimdışıyken outbox'a yazılır ve bağlantı geldiğinde bağımsız API'ye idempotent batch olarak gönderilir.

Mobil istemci yalnızca public değerleri kullanır:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Supabase projesinde **Authentication → Sign In / Providers** altında hem **Anonymous Sign-Ins** hem de **Allow manual linking** etkin olmalıdır. Profil sekmesi anonim kullanıcıya e-posta doğrulama kodu gönderir ve kod doğrulandığında mevcut Supabase kullanıcı UUID'sini değiştirmeden kalıcı e-posta kimliğini bağlar. API tarafında aynı proje URL'si `SUPABASE_URL` olarak tanımlanır; erişim tokenları Supabase JWKS üzerinden doğrulanır. Service-role veya JWT secret mobil uygulamaya eklenmez.

## Server build

Expo Router API Routes nedeniyle web çıktısı `server` modundadır; yalnızca statik hosting yeterli değildir.

```bash
npm run server:build
npm run server:serve
```

Üretim çıktısı `apps/mobile/dist/client` ve `apps/mobile/dist/server` altında oluşur. Bu paket EAS Hosting veya Expo server adapter destekleyen başka bir sunucuya dağıtılabilir. Gerçek deployment için seçilen hosting projesinin kimliği/hesabı ve gerekiyorsa `EXPO_TOKEN` yapılandırılmalıdır.
