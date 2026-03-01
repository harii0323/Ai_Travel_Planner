# AI Travel Planner Frontend

React-based user interface for the AI Travel Planner application. Provides an intuitive form for travel planning and a comprehensive dashboard for viewing personalized itineraries.

## Project Structure

```
frontend/
├── src/
│   ├── App.js                          # Main application component
│   ├── App.css                         # Main styling
│   ├── components/
│   │   ├── ItineraryForm.js            # User input form component
│   │   └── ItineraryDisplay.js         # Results display component
│   ├── styles/
│   │   ├── ItineraryForm.css           # Form styling
│   │   └── ItineraryDisplay.css        # Display styling
│   ├── index.js                        # React entry point
│   └── index.css                       # Global styles
├── public/
│   └── index.html                      # HTML template
├── package.json
└── README.md
```

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

Application opens at `http://localhost:3000`

**Note:** Backend must be running on `http://localhost:5000`

## Components

### App.js
Main application component that manages overall state and API communication.

**Features:**
- Loading state management
- Error handling
- Response display
- Header with branding
- Footer with disclaimer

### ItineraryForm.js
User input form with validation and rich selector options.

**Features:**
- Budget input with validation
- Date range picker (text input with format: YYYY-MM-DD to YYYY-MM-DD)
- Location fields (start and destination)
- Activity checkboxes (Adventure, Cultural, Food, Nature)
- Accommodation dropdown with pricing info
- Transport mode dropdown with discount info
- Form validation with error messages
- Loading state during submission

**Form Fields:**
```
Budget:          USD amount (required)
Travel Dates:    Format: YYYY-MM-DD to YYYY-MM-DD (required)
Start Location:  City/location (required)
Destination:     City/location (required)
Activities:      Multi-select checkboxes (optional)
Accommodation:   Dropdown with types (required)
Transport:       Dropdown with modes (required)
```

### ItineraryDisplay.js
Multi-tab interface for viewing itinerary results.

**Features:**
- Tabbed navigation (Overview, Costs, Itinerary, Tips, Alternatives)
- Cost summary cards with visual breakdown
- Detailed cost tables
- Day-by-day expansion interface
- Money-saving tips display
- Alternative plan cards
- Expandable sections for detailed information
- Error handling for invalid responses

**Tabs:**
1. **Overview** - Trip summary, accommodation details, food estimates
2. **Cost Breakdown** - Detailed expense analysis with budget comparison
3. **Day-by-Day** - Expandable daily plans with activities
4. **Money Tips** - 15+ money-saving strategies for students
5. **Alternatives** - Alternative itineraries if budget exceeded

## Styling

### Color Scheme
- **Primary**: Purple gradient (#667eea to #764ba2)
- **Success**: Green (#51cf66)
- **Warning**: Yellow (#ffc107)
- **Error**: Red (#ff6b6b)
- **Background**: Light gray (#f8f9fa)
- **Text**: Dark gray (#333)

### Design System
- **Rounded corners**: 8-12px border radius
- **Spacing**: 8px base unit with 2x, 3x, 4x, 5x multiples
- **Shadows**: Subtle 0 4px 6px rgba(0,0,0,0.1) pattern
- **Transitions**: 0.3s ease for all interactive elements
- **Font**: Segoe UI, Tahoma, Geneva, Verdana, sans-serif

### CSS Files

**App.css**
- Main layout structure
- Header and footer styling
- Global card styling
- Loading and error states
- Responsive breakpoints

**ItineraryForm.css**
- Form section organization
- Input and select styling
- Activity grid layout
- Form validation display
- Button styling

**ItineraryDisplay.css**
- Tabbed interface
- Cost card grid
- Expandable day plans
- Tips list grid
- Alternative cards
- Table styling

## Features Implemented

### Form Validation
- Budget: Must be positive number
- Dates: Format validation (YYYY-MM-DD to YYYY-MM-DD)
- Locations: Must not be empty
- Accommodation & Transport: Required selections

### User Experience
- Real-time error display
- Loading spinner during API call
- Disabled submit button while loading
- Form cleanup after submission
- Tooltip hints for form fields
- Responsive design for mobile/tablet

### Cost Visualization
- Color-coded cost cards (Transport, Accommodation, Food, Activities, etc.)
- Progress bar showing budget usage
- Clear breakdowns with icons
- Daily cost calculations

### Itinerary Display
- Expandable day cards (click to expand/collapse)
- Activity lists with costs
- Daily meal breakdown
- Money-saving tips cards
- Alternative plan comparison

## NPM Scripts

- `npm start` - Start development server
- `npm build` - Create production build
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

## Dependencies

- **react**: UI framework
- **react-dom**: React DOM rendering
- **axios**: HTTP client for API calls
- **react-scripts**: Build tools and scripts

## API Integration

### Endpoint
```
POST http://localhost:5000/api/itinerary
```

### Request Format
```json
{
  "budget": 1500,
  "travelDates": "2024-06-15 to 2024-06-22",
  "startLocation": "New York",
  "destination": "Barcelona",
  "activities": "cultural, nature, food",
  "accommodation": "hostel",
  "transport": "flight"
}
```

### Response Handling
- Success: Display itinerary with all tabs
- Error: Show error message with close button
- Loading: Show spinner during request

## Responsive Design

### Breakpoints
- **Desktop**: 1200px+ (full layout)
- **Tablet**: 768px-1199px (adjusted grids)
- **Mobile**: <768px (stacked layout)

### Mobile Optimizations
- Single column layouts
- Larger touch targets
- Reduced padding/margins
- Smaller font sizes
- Horizontal scroll tabs
- Simplified navigation

## Customization

### Change Colors
Edit color values in CSS files:
- Primary gradient: Update `#667eea` and `#764ba2`
- Success: Update `#51cf66`
- Error: Update `#ff6b6b`

### Add Form Fields
In ItineraryForm.js:
1. Add to state initialization
2. Add form group section
3. Add handleChange if needed
4. Add validation if required

### Modify Tabs
In ItineraryDisplay.js:
1. Add tab button in `.tabs` section
2. Add tab content in `if activeTab === 'name'` condition
3. Update styling in CSS

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Considerations
- Component-based architecture for reusability
- Efficient state management
- Minimal re-renders
- CSS animations for smooth UX
- Responsive images and icons

## Accessibility Features
- Semantic HTML elements
- Form labels with for attributes
- Error messages linked to inputs
- Keyboard navigation support
- Clear focus states
- High contrast colors

## Future Enhancements

- [ ] Map integration for visual route
- [ ] Save/share itinerary functionality
- [ ] User authentication for saved trips
- [ ] Calendar view for itinerary
- [ ] Activity gallery with photos
- [ ] Real-time price updates
- [ ] Compare multiple itineraries
- [ ] Mobile app (React Native)
- [ ] Dark mode support
- [ ] Multi-language support

## Troubleshooting

### Backend Connection Error
```
Error: Failed to fetch itinerary
```
**Solution:** Ensure backend is running on `http://localhost:5000`

### Port Already in Use
```bash
# Kill process on port 3000 and restart
npm start
```

### Dependencies Installation Issues
```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### CSS Not Loading
- Check file paths in imports
- Ensure CSS files are in `src/styles/` directory
- Clear browser cache (Ctrl+Shift+Delete)

## Development Tips

1. **Debug State**: Add console.log in components
2. **Browser DevTools**: F12 to inspect elements and network
3. **React DevTools**: Install React browser extension
4. **API Testing**: Use Postman to test backend first
5. **Styling**: Test with DevTools responsive mode

---

**Built with React & CSS | Made for Budget-Conscious Students**