# Oahu Snorkel Report

Oahu Snorkel Report is a shore-by-shore snorkeling conditions project for Oahu. The repo contains the front-end site, shared scoring logic, region pages, map view, forecast pages, and feedback flow used to present daily snorkeling conditions around the island.

## What the Project Does

- Shows live snorkeling condition scores across Oahu shore regions
- Breaks conditions down by East, South, North, and West shore spots
- Includes standalone region pages with summaries, charts, and outlooks
- Provides day and week forecast views
- Includes an interactive map with region popups
- Lets users submit field feedback for comparison against the live model

## Main Pages

- `index.html` - homepage
- `live-report.html` - live shore-by-shore report
- `day-forecast.html` - short-range daylight forecast charts
- `week-forecast.html` - 7-day outlook table
- `map.html` - interactive map view
- `detailed-reports.html` - region directory
- `search.html` - region/date search page
- `feedback.html` - field feedback form
- `about.html` - methodology and project background
- `blog.html` - supporting articles

## Regions Covered

- `lanikai-kailua`
- `waimanalo`
- `kaneohe-bay`
- `waikiki`
- `ala-moana`
- `hawaii-kai`
- `haleiwa`
- `waimea-bay`
- `pupukea`
- `ko-olina`
- `pokai-bay`
- `nanakuli`

## Tech Stack

- HTML
- CSS
- JavaScript
- Chart.js
- Leaflet
- Open-Meteo data
- NOAA tide data

## Repo Structure

```text
snorkel-report/
|-- assets/                  # Icons, favicon, and shared images
|-- css/
|   `-- styles.css           # Shared site styles
|-- js/
|   |-- day-forecast.js
|   |-- feedback.js
|   |-- map.js
|   |-- navigation.js
|   |-- region-report.js
|   |-- report.js
|   |-- search.js
|   |-- seo.js
|   |-- snorkel-shared.js
|   `-- week-forecast.js
|-- *.html                   # Site pages and region pages
|-- schema.sql               # Feedback database schema
|-- worker.js                # Request handling and API entry point
|-- wrangler.jsonc           # Worker config
|-- README.md
`-- SETUP.md
```

## Local Development

Run a local server from the project root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

You can also use a local static server such as VS Code Live Server.

## Data Sources

- Open-Meteo Marine API
- Open-Meteo Forecast API
- NOAA Tides & Currents API

## Scoring Model

The snorkel score is a region-aware heuristic on a `1-10` scale. It uses a mix of:

- wave height
- swell height and period
- wind wave height
- wind speed and direction
- current speed and direction
- tide level
- cloud cover
- rain
- shoreline exposure and protection

Most of the shared scoring and region configuration lives in `js/snorkel-shared.js`.

## Notes

- Live conditions depend on third-party API availability
- The project mixes static page templates with shared client-side rendering
- Feedback storage depends on the configured backend environment

## License

MIT
