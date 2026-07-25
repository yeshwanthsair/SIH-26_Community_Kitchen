# API Reference

Base URL: `http://localhost:3000/api`

All successful responses follow this shape:

```json
{ "success": true, "message": "...", "data": {} }
```

Validation failures return HTTP `400`; missing records return `404`; duplicate record dates return `409`.

## Dashboard

### `GET /dashboard`

Returns the current date, latest record, all-time and current-month summaries, status counts, top days, stock trend, and recent records.

```bash
curl http://localhost:3000/api/dashboard
```

## Records

### `GET /records`

Lists records with optional filtering, sorting, and pagination.

| Query parameter | Allowed values | Default |
|---|---|---|
| `date` | Valid `YYYY-MM-DD` | — |
| `month` | Valid `YYYY-MM` | — |
| `status` | `open`, `closed`, `holiday` | — |
| `sort` | `id`, `date`, `meals_served`, `stock_balance`, `cost_per_meal`, `created_at` | `date` |
| `order` | `ASC`, `DESC` | `DESC` |
| `page` | Positive integer | `1` |
| `limit` | Integer from `1` to `200` | `20` |

```bash
curl "http://localhost:3000/api/records?month=2024-03&status=open&sort=date&order=ASC"
```

### `POST /records`

Creates a single daily record. `date` must be unique and a real calendar date.

```json
{
  "date": "2024-04-10",
  "meals_served": 250,
  "rice_kg": 32.5,
  "dal_kg": 13,
  "vegetables_kg": 22,
  "stock_balance": 180,
  "cost_per_meal": 22.5,
  "rice_per_meal": 0.13,
  "status": "open"
}
```

Rules:

- `meals_served` is a non-negative integer.
- Numeric quantity and cost fields are non-negative numbers.
- `status` is `open`, `closed`, or `holiday`.
- Closed and holiday days should normally use zero operational quantities.

### `PUT /records/:id`

Updates one or more allowed record fields. The ID must be a positive integer and any changed date must remain unique.

```bash
curl -X PUT http://localhost:3000/api/records/12 \
  -H "Content-Type: application/json" \
  -d '{"meals_served":260,"rice_kg":34}'
```

### `DELETE /records/:id`

Deletes an existing record.

```bash
curl -X DELETE http://localhost:3000/api/records/12
```

## Analytics

### `GET /analytics`

Returns an all-time summary plus weekly, monthly, and yearly breakdowns; top days; stock trend; low-stock and variance analysis; abnormal-usage flags; and status breakdown.

Use the optional `month` query parameter to scope the summary to a valid `YYYY-MM` month:

```bash
curl "http://localhost:3000/api/analytics?month=2024-03"
```

## Chat

### `POST /chat`

Accepts a non-empty message up to 1,000 characters and returns a recognized intent, a plain-language answer, and supporting data.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the current stock balance?"}'
```

Supported intents include:

- `meals_today`
- `rice_stock`
- `average_meals`
- `highest_meals`
- `rice_usage`
- `cost`
- `low_stock`
- `monthly_meals`
- `total_meals`
- `summary`
- `status_info`
- `unknown`

Unknown questions deliberately return the deterministic fallback: “I don't know that yet.”

## Error Example

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "date": "invalid calendar date"
  }
}
```
