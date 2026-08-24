CREATE FUNCTION prevent_published_puzzle_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM puzzle_publications
		WHERE puzzle_record_id = OLD.record_id
			AND published_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Published puzzle definitions are immutable.'
			USING ERRCODE = 'check_violation';
	END IF;

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER puzzles_prevent_published_mutation
BEFORE UPDATE OR DELETE ON puzzles
FOR EACH ROW
EXECUTE FUNCTION prevent_published_puzzle_mutation();
--> statement-breakpoint
CREATE FUNCTION preserve_puzzle_publication_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD.published_at IS NULL THEN
		IF TG_OP = 'DELETE' THEN
			RETURN OLD;
		END IF;

		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Published puzzle publication history is immutable.'
			USING ERRCODE = 'check_violation';
	END IF;

	IF ROW(
		NEW.publication_date,
		NEW.publication_key,
		NEW.published_at,
		NEW.puzzle_record_id,
		NEW.required_entitlement,
		NEW.timezone
	) IS DISTINCT FROM ROW(
		OLD.publication_date,
		OLD.publication_key,
		OLD.published_at,
		OLD.puzzle_record_id,
		OLD.required_entitlement,
		OLD.timezone
	) THEN
		RAISE EXCEPTION 'Published puzzle publication history is immutable.'
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER puzzle_publications_preserve_history
BEFORE UPDATE OR DELETE ON puzzle_publications
FOR EACH ROW
EXECUTE FUNCTION preserve_puzzle_publication_history();
