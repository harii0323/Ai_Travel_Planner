import React from 'react';

/**
 * Standard Accessible DatePicker Component
 * Renders native calendar date picker matching the design system
 * Eliminates Webpack dynamic expression warnings from third-party datepickers.
 */
export default function DatePicker({
  selected,
  onChange,
  minDate,
  placeholderText = 'Select date',
  dateFormat = 'yyyy-MM-dd'
}) {
  const formatDateForInput = (d) => {
    if (!d) return '';
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleChange = (e) => {
    const val = e.target.value;
    if (!val) {
      if (typeof onChange === 'function') onChange(null);
      return;
    }
    const [y, m, d] = val.split('-').map(Number);
    const newDate = new Date(y, m - 1, d);
    if (typeof onChange === 'function') onChange(newDate);
  };

  const minStr = minDate ? formatDateForInput(minDate) : undefined;
  const valStr = selected ? formatDateForInput(selected) : '';

  return (
    <div className="react-datepicker-wrapper">
      <div className="react-datepicker__input-container">
        <input
          type="date"
          value={valStr}
          min={minStr}
          onChange={handleChange}
          placeholder={placeholderText}
          aria-label={placeholderText}
        />
      </div>
    </div>
  );
}

