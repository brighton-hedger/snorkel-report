# Oʻahu Snorkel Report Website

A fully functional Hawaiian snorkel report website featuring real-time ocean and weather conditions across six regions of Oʻahu.

## Features

- **Snorkel Report Page**: Current conditions and snorkel scores for all six regions
- **Day Forecast**: 3-day hourly forecast with interactive charts using Chart.js
- **Week Forecast**: 7-day overview table with daily average scores
- **Real-time Data**: Fetches live marine and weather data from Open-Meteo API
- **Tide Information**: Integration with NOAA tide predictions
- **Responsive Design**: Mobile-friendly layout that adapts to all screen sizes

## Project Structure

```
snorkel-report/
├── index.html              # Main snorkel report page
├── day-forecast.html       # Day forecast with charts
├── week-forecast.html      # Week forecast table
├── css/
│   └── styles.css         # All styling (responsive design)
├── js/
│   ├── navigation.js       # Navigation and page switching
│   ├── report.js           # Main snorkel report logic
│   ├── day-forecast.js     # Day forecast chart generation
│   └── week-forecast.js    # Week forecast table population
└── README.md               # This file
```

## Regions Covered

1. **Windward East** - Kailua, Waimānalo, Makapuʻu
2. **South Shore** - Waikīkī, Ala Moana, Kewalo
3. **North Shore** - Haleʻiwa, Waimea, Pūpūkea
4. **West Shore** - ʻEwa, Ko ʻOlina, Electric Beach
5. **South East Shore** - Koko Head, Hawaiʻi Kai, Hanauma Bay
6. **Windward North** - Kāneʻohe, Kahaluʻu, Heʻeia

## Running the Website

### Option 1: Using Python (Recommended)

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

### Option 2: Using Node.js

```bash
# Install global-http-server (one time)
npm install -g global-http-server

# Run in the project directory
ghs
```

### Option 3: Using Live Server Extension in VS Code

1. Install the "Live Server" extension by Ritwick Dey
2. Right-click `index.html` and select "Open with Live Server"

### Option 4: Direct File Access

Simply open `index.html` in your browser:
```
file:///path/to/snorkel-report/index.html
```

## Data Sources

- **Marine Data**: [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api)
- **Weather Data**: [Open-Meteo Weather API](https://open-meteo.com/en/docs/forecast-api)
- **Tide Data**: [NOAA Tides & Currents](https://tidesandcurrents.noaa.gov/api/)

## Scoring Algorithm

The snorkel score (1-10) is calculated based on:

- Wave height (< 5ft is ideal)
- Swell conditions (< 3ft preferred)
- Swell period (6-12s is optimal)
- Wind wave height (< 3ft is good)
- Ocean currents (< 1.5 mph preferred)
- Cloud cover (< 60% for visibility)
- Precipitation (minimal rain)
- Tide conditions

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Customization

### Adding New Regions

Edit the `regions` array in the respective JavaScript files:

```javascript
const regions = [
  { title: "Region Name", towns: "(Town 1, Town 2)", lat: 21.3300, lng: -157.6700 },
  // Add more regions...
];
```

### Styling

All CSS is contained in `css/styles.css`. Key color variables:
- Primary: `#2aa198` (teal)
- Background: `#e0f7f4` (light teal)
- Good Score: `#1eaa5a` (green)
- Medium Score: `#e6a800` (orange)
- Poor Score: `#cc3300` (red)

### API Keys

Currently, no API keys are required. Open-Meteo provides free data without authentication.

## Error Handling

- API call failures are caught and logged
- User-friendly error messages are displayed if data fails to load
- Page continues to function even if some API calls fail

## Performance Optimizations

- Lazy loading of data per region
- Efficient chart rendering using Chart.js
- Responsive-first design
- Minimal HTTP requests

## Future Enhancements

- [ ] Local storage for cached data
- [ ] Offline mode support
- [ ] Water temperature alerts
- [ ] Photo gallery for each region
- [ ] User reviews and ratings
- [ ] Mobile app version
- [ ] Historical data and trends
- [ ] SMS/Email alerts for optimal conditions

## License

Personal project by Brighton Hedger

## Questions or Issues?

For bugs or feature requests, please open an issue or contact the developer.
