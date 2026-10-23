# HTTP API

JSON endpoints are under `/api`. Human sessions use an HTTP-only `erams_session` cookie obtained from `POST /auth/login`. Roles are enforced server-side. Browser mutations must originate from `WEB_ORIGIN`. Kiosks instead use `Authorization: Kiosk <device-token>` and can only access `/kiosk/punch`.

| Method / route | Roles | Purpose |
| --- | --- | --- |
| GET `/health` | Public | Database readiness; no employee data |
| POST `/auth/login` | Public | `{email,password}`, rate-limited, sets cookie |
| GET `/auth/me` | Human | Current actor |
| POST `/auth/logout` | Human | Revoke session and clear cookie |
| GET `/dashboard` | Human | Current day totals, departments, attendance feed |
| GET `/employees` | Human | Directory and enrollment status; no templates |
| POST `/employees` | Admin/HR | Employee number, names, department, position, shiftId |
| PATCH `/employees/:id` | Admin/HR | Edit/deactivate employee |
| POST `/employees/:id/enroll` | Admin/HR | `{image,consent:true,signature,policyVersion:"biometric-v1"}` |
| DELETE `/employees/:id/biometric` | Admin/HR | Withdraw consent and delete template |
| GET `/shifts` | Human | Schedules and employee counts |
| POST `/shifts` | Admin/HR | Create schedule; integer minutes since midnight |
| GET `/attendance?date=YYYY-MM-DD` | Human | Service-day punches including voided records |
| POST `/attendance/manual` | Admin/HR | `{employeeId,kind,occurredAt,reason,key}` |
| POST `/attendance/:id/void` | Admin/HR | `{reason}`; original punch is preserved |
| GET `/reports/dtr?employeeId=…&month=YYYY-MM` | Human | Monthly JSON report; access is audited |
| GET `/reports/dtr.pdf?employeeId=…&month=YYYY-MM` | Human | Download draft DTR PDF |
| GET `/audit?cursor=UUID` | Human | Cursor pagination, 50 events per page |
| GET/POST `/users` | Admin | List / create administrative accounts |
| PATCH `/users/:id` | Admin | `{active}`; cannot disable own account |
| GET/POST `/kiosks` | Admin | List / create devices; new token returned once |
| DELETE `/kiosks/:id` | Admin | Revoke device token |
| GET `/system` | Human | AI readiness and timezone |
| POST `/kiosk/punch` | Kiosk only | `{image,kind,key}`; API supplies timestamp |

Punch kinds: `AM_IN`, `AM_OUT`, `PM_IN`, `PM_OUT`. `key` is a UUID generated once per logical attendance request. Duplicate keys return the original non-voided punch only for the same actor, employee, and kind. A different key attempting the same active slot returns HTTP 409.

Images are data URLs (`data:image/jpeg;base64,…` or PNG), up to 2.8 million encoded characters. Bodies are capped at 3 MB. Consent signatures are typed names, 3–120 characters. Manual correction reasons are 5–500 characters. IDs must be UUIDs.

Socket.IO uses the same session cookie. It emits `attendance:changed` invalidations with no employee payload; clients fetch fresh data through the normal API. Sessions expire after eight hours and are revoked on logout. Disabling accounts blocks subsequent requests.

The private Python service exposes authenticated `/health`, `/extract`, and `/recognize` endpoints using `X-Service-Key`. It has no public Swagger UI. Templates and model scores are never exposed by the browser API.
