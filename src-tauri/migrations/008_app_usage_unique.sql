UPDATE app_usage
SET duration_seconds = (
    SELECT SUM(duplicate.duration_seconds)
    FROM app_usage AS duplicate
    WHERE duplicate.app_name = app_usage.app_name
      AND duplicate.recorded_date = app_usage.recorded_date
      AND duplicate.hour = app_usage.hour
)
WHERE id IN (
    SELECT MIN(id)
    FROM app_usage
    GROUP BY app_name, recorded_date, hour
    HAVING COUNT(*) > 1
);

DELETE FROM app_usage
WHERE id NOT IN (
    SELECT MIN(id)
    FROM app_usage
    GROUP BY app_name, recorded_date, hour
);

CREATE UNIQUE INDEX idx_usage_app_date_hour
ON app_usage(app_name, recorded_date, hour);
