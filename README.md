# Çengel

Expo SDK 54 ile geliştirilen, yerel ilerleme kaydı ve sunucudan yayınlanan sabit günlük bulmacalar kullanan çengel bulmaca uygulaması.

Bağımsız API, generator worker, kullanıcı verisi ve abonelik mimarisinin aşamalı uygulama planı için [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) belgesine bakın.

## Geliştirme

```bash
npm install
npm start
```

Temel kontroller:

```bash
npm run lint
npx tsc --noEmit
npm run dataset:check
npm run test:generator
npm run puzzles:check
npm run test:engine
npm run test:progress
```

## İçerik üretimi

Ham JSONL yalnızca build araçları tarafından okunur; Expo runtime içine alınmaz.

```bash
npm run dataset:build
npm run puzzles:build
```

Tek bir günlük yayın üretmek:

```bash
npm run daily:generate -- --date 2026-08-23 --profile easy-mixed-wide --revision v1 --output data/generated/daily/gunun-2026-08-23.json
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

Üretim otomasyonu [.github/workflows/publish-daily-puzzles.yml](.github/workflows/publish-daily-puzzles.yml) içinde her gün `21:10 UTC` (`00:10 Europe/Istanbul`) çalışır. Aynı workflow elle de başlatılabilir.

## API ve çevrimdışı çalışma

Salt-okunur endpointler:

- `GET /api/puzzles`
- `GET /api/puzzles/:id`

API ETag, `304 Not Modified`, `404` ve cache başlıklarını destekler. Web aynı origin üzerindeki API’yi kullanır. Android ve iOS için üretim origin’i tanımlanmalıdır:

```bash
EXPO_PUBLIC_PUZZLE_API_URL=https://your-cengel-api.example.com
```

Native katalog önbelleği Expo SQLite’ta, web önbelleği `localStorage` içinde tutulur. Ağ yoksa önbellek; önbellek de yoksa uygulamayla gelen manifest kullanılır.

## Server build

Expo Router API Routes nedeniyle web çıktısı `server` modundadır; yalnızca statik hosting yeterli değildir.

```bash
npm run server:build
npm run server:serve
```

Üretim çıktısı `dist/client` ve `dist/server` altında oluşur. Bu paket EAS Hosting veya Expo server adapter destekleyen başka bir sunucuya dağıtılabilir. Gerçek deployment için seçilen hosting projesinin kimliği/hesabı ve gerekiyorsa `EXPO_TOKEN` yapılandırılmalıdır.
