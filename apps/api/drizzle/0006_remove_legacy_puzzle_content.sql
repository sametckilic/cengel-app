-- The project had no production users when the fixed-topology/freeform catalog was retired.
-- Remove only the verified legacy puzzle IDs so the API cannot surface them after cutover.
DELETE FROM "user_puzzle_progress"
WHERE "puzzle_id" IN (
	'newspaper-prototype-8x8',
	'gunun-2026-08-19',
	'gazete-genis-kolay-001',
	'edebiyat-orta-002',
	'karma-zor-001',
	'cografya-baslangic-002',
	'gunun-2026-08-23',
	'gunun-2026-08-24',
	'gunun-2026-08-25',
	'gunun-2026-08-26',
	'gunun-2026-08-27',
	'gunun-2026-08-28',
	'gunun-2026-08-29',
	'gunun-2026-08-30'
);
--> statement-breakpoint
DELETE FROM "progress_events"
WHERE "puzzle_id" IN (
	'newspaper-prototype-8x8',
	'gunun-2026-08-19',
	'gazete-genis-kolay-001',
	'edebiyat-orta-002',
	'karma-zor-001',
	'cografya-baslangic-002',
	'gunun-2026-08-23',
	'gunun-2026-08-24',
	'gunun-2026-08-25',
	'gunun-2026-08-26',
	'gunun-2026-08-27',
	'gunun-2026-08-28',
	'gunun-2026-08-29',
	'gunun-2026-08-30'
);
--> statement-breakpoint
DELETE FROM "puzzle_publications"
WHERE "puzzle_record_id" IN (
	SELECT "record_id"
	FROM "puzzles"
	WHERE "id" IN (
		'newspaper-prototype-8x8',
		'gunun-2026-08-19',
		'gazete-genis-kolay-001',
		'edebiyat-orta-002',
		'karma-zor-001',
		'cografya-baslangic-002',
		'gunun-2026-08-23',
		'gunun-2026-08-24',
		'gunun-2026-08-25',
		'gunun-2026-08-26',
		'gunun-2026-08-27',
		'gunun-2026-08-28',
		'gunun-2026-08-29',
		'gunun-2026-08-30'
	)
);
--> statement-breakpoint
DELETE FROM "puzzles"
WHERE "id" IN (
	'newspaper-prototype-8x8',
	'gunun-2026-08-19',
	'gazete-genis-kolay-001',
	'edebiyat-orta-002',
	'karma-zor-001',
	'cografya-baslangic-002',
	'gunun-2026-08-23',
	'gunun-2026-08-24',
	'gunun-2026-08-25',
	'gunun-2026-08-26',
	'gunun-2026-08-27',
	'gunun-2026-08-28',
	'gunun-2026-08-29',
	'gunun-2026-08-30'
);
--> statement-breakpoint
DELETE FROM "generation_runs"
WHERE "publication_date" BETWEEN '2026-08-19' AND '2026-08-30'
	AND (
		"revision" = 'v1'
		OR "revision" LIKE 'schedule-v1%'
	);
