# Changelog

All notable changes to this project are documented here.
Format: [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`

---

## [v1.2.1] - 2026-04-21
### Fixed
- Tabellen-Header bleibt beim vertikalen Scrollen oben fixiert (`position: sticky; top: 0`)

---

## [v1.2.0] - 2026-04-21
### Changed
- Page is no longer scrollable; only the contacts table scrolls within the viewport
- `.empty` state (no contacts / no results) now fills the remaining space and centers its message

### Added
- Centralized version management via `lib/version.ts` — update `APP_VERSION` there to change what the footer displays
- `CHANGELOG.md` for tracking releases going forward
- Changelog & version update policy in `CLAUDE.md`

---

## [v1.1.0]
### Added
- Sortable columns with asc / desc / off cycle
- Per-column filter dropdowns in table headers
- Global search bar across all contact fields
- Tab system: "Offene" vs "Angeschriebene"
- Per-row PDF download button
- PDF compression when merging multiple letters
- Edit contact modal

### Fixed
- Letter salutation formatting
- QR code rendering improvements

---

## [v1.0.0]
### Added
- Initial release: contact list loaded from Supabase
- CSV import with duplicate detection (Firma + Straße + PLZ)
- Bulk PDF letter generation with logo, signature, and QR code
