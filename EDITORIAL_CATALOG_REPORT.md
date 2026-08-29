# Çengel — Editoryal Katalog Azaltma Raporu

Güncelleme: 29 Ağustos 2026

## Karar

Editoryal azaltma şu anda **kapalıdır**. `datasets/crossword_clues_gameplay_ready.jsonl` içindeki `gameplay_status: ready` olan 48.093 kaydın tamamı generator kataloğuna alınır. Mevcut katalog boyutu operasyonel bir sorun oluşturmadığı ve küçük kategoriler hâlâ görece az içerik taşıdığı için otomatik eleme yapılmayacaktır.

## Ölçüm tabanı

| Ölçüm | Güncel değer |
| --- | ---: |
| Generator kataloğundaki kayıt | 48.093 |
| Benzersiz normalize cevap | 35.584 |
| Alternatif cevap kaydı | 12.509 |
| Benzersiz cevap + kısa soru çifti | 46.582 |
| Bütün alanları aynı olan eşdeğer fazla kayıt | 2 |
| Cevap uzunluğu aralığı | 2–37 |
| Önerilen 2–11 uzunluklarında eksik havuz | 0 |
| Kategori × zorluk segmenti | 80 / 80 |

Zorluk dağılımı:

| Zorluk | Kayıt | Benzersiz cevap |
| --- | ---: | ---: |
| Başlangıç | 4.157 | 3.105 |
| Kolay | 16.073 | 12.708 |
| Orta | 12.661 | 10.869 |
| Zor | 15.202 | 13.005 |

En küçük kategori havuzları `kisi` (213), `kurum` (308), `yer` (412) ve `diger` (418) kayıt içerir. En büyük havuz `turkce` kategorisidir (20.164). Bu dağılım, toplam kayıt sayısı yüksek görünse bile kategori bazında erken azaltmanın temalı üretim çeşitliliğini düşürebileceğini gösterir.

## Gelecekteki azaltma kapısı

Bir azaltma politikası ancak dry-run raporu aşağıdaki koşulların tamamını sağladığında etkinleştirilebilir:

- Benzersiz normalize cevap kapsamı `%100` kalmalı.
- Benzersiz cevap + `shortClue` kapsamı `%100` kalmalı.
- Her kategori × zorluk × cevap uzunluğu segmentindeki benzersiz cevap sayısı azalmamalı.
- 2–37 arasındaki mevcut cevap uzunluğu kapsamı korunmalı; yalnızca sık kullanılan kısa aralığa göre eleme yapılmamalı.
- Bütün gazete recipe matrisi, generator testleri ve puzzle kalite kontrolleri aynı sonuçla geçmeli.
- Azaltma ayrı ve açık bir yayın kararı olmalı; dataset build sırasında kendiliğinden devreye girmemeli.

Bugünkü katalogda tamamen eşdeğer yalnızca 2 fazla kayıt bulunması, ayrı bir azaltma hattının operasyonel karmaşıklığını haklı çıkarmıyor. Dataset anlamlı ölçüde büyüdüğünde bu dosyadaki taban ölçümler yeniden alınacak ve dry-run sonucu önce incelemeye sunulacaktır.
